# Plano 006 — Migrar persistência para Postgres (Neon) + hash de senhas

## Contexto

O app MotoBoyApp está rodando em produção no Render (`https://motozap.onrender.com`) com persistência em arquivo JSON (`server/db.json`). O Render free tier tem **disco efêmero**: cada vez que o serviço hiberna (após ~15 min sem tráfego), acorda, ou há um deploy, o arquivo é perdido — todas as contas, lojas e pedidos somem. Isso já foi observado várias vezes na sessão atual.

A solução é mover a persistência para Postgres hospedado em um provedor com free tier **permanente** (Render Postgres expira em 30 dias, fora de cogitação). **Neon** ([neon.com](https://neon.com/pricing)) tem free tier permanente, 0.5 GB por projeto, sem cartão de crédito, conexão via `node-postgres` padrão.

Em paralelo, o `db.json` armazena senhas em texto puro. Migrar para **bcrypt** (hash + salt) protege contra vazamentos caso o DB seja comprometido.

## Decisões confirmadas com o usuário

- **Host Postgres**: [Neon](https://neon.com/pricing) — free tier permanente, 0.5 GB
- **Driver Node**: [node-postgres](https://node-postgres.com/) (`pg`) — padrão de mercado, suporta pooled connection do Neon
- **Hash de senhas**: Sim, com [bcrypt](https://www.npmjs.com/package/bcrypt) (salt + hash)

## Estado atual (mapeado em `server/sync.js`)

- `db = { usuarios: [], pedidos: [], lojas: [] }` — objeto em memória
- `loadDb()` lê `server/db.json` no boot (linhas 307-322)
- `saveDb()` escreve `JSON.stringify(db)` após cada mutação (linhas 324-329)
- Rotas que mutam DB (todas chamam `saveDb()`):
  - `POST /usuarios` (linha 731) — cria usuário com `senha` plain
  - `POST /lojas` (linha 772) — cria loja
  - `POST /pedidos` (linha 825) — cria pedido
  - `PATCH /pedidos/:id` (linha 862) — atualiza status
  - `DELETE /pedidos/:id` (linha 806) — exclui
  - `DELETE /pedidos` (linha 818) — limpa todos
- Rotas de leitura (não mutam):
  - `GET /usuarios`, `POST /session`, `GET /lojas`, `GET /loja`, `GET /lojas/pedidos`, `GET /pedidos`

## Tarefas

### 1. Provisionar o Neon

**Onde**: site do Neon.

1. Criar conta em [neon.tech](https://neon.tech) (login via GitHub é mais rápido)
2. Criar projeto: `motozap-prod` (region: AWS US East ou a mais próxima do Render — Oregon)
3. Após criado, copiar **duas** connection strings da dashboard:
   - **Pooled connection** (para o app): `postgresql://neon:xxx@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **Direct connection** (para migrations/setup): `postgresql://neon:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. **Entregar essas duas strings para o executor** — ele vai colocar como env vars no Render

### 2. Adicionar dependências

**Onde**: `package.json` (raiz do `MotoBoyApp`).

```bash
cd MotoBoyApp
npm install pg bcrypt
npm install --save-dev @types/pg @types/bcrypt
```

`pg` e `bcrypt` são zero-configuração em Node — não precisam de mudança no `render.yaml` (já é Node 20).

### 3. Schema do banco

**Onde**: criar `server/schema.sql` (novo arquivo).

```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id           TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  senha_hash   TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('motoboy','lojista')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lojas (
  id           TEXT PRIMARY KEY,
  motoboy_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  code         TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lojas_motoboy ON lojas(motoboy_id);

CREATE TABLE IF NOT EXISTS pedidos (
  id                 TEXT PRIMARY KEY,
  motoboy_id         TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motoboy_nome       TEXT NOT NULL,
  loja_code          TEXT REFERENCES lojas(code) ON DELETE SET NULL,
  comanda_numero     TEXT NOT NULL DEFAULT '',
  cliente_nome       TEXT NOT NULL DEFAULT '',
  cliente_endereco   TEXT NOT NULL DEFAULT '',
  cliente_telefone   TEXT NOT NULL DEFAULT '',
  cliente_referencia TEXT NOT NULL DEFAULT '',
  valor_total        NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_pedido       NUMERIC(10,2) NOT NULL DEFAULT 0,
  formas_pagamento   JSONB NOT NULL DEFAULT '[]'::jsonb,
  foto_comanda       TEXT,
  distancia          NUMERIC(6,2),
  cliente_lat        NUMERIC(10,7),
  cliente_lon        NUMERIC(10,7),
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','saiu','a_caminho','cheguei','entregue','cancelado')),
  sub_status         TEXT
                       CHECK (sub_status IS NULL OR sub_status IN ('contatando','contato_ok','cobrando')),
  historico          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy ON pedidos(motoboy_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_loja ON pedidos(loja_code);
CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at DESC);
```

### 4. Helper de DB

**Onde**: criar `server/db.js` (novo arquivo).

Pequeno módulo que encapsula o pool e helpers de migrate/query. Não modifica `sync.js` inteiro — só exporta as funções usadas.

```js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_POOL,
  ssl: { rejectUnauthorized: false }, // Neon exige SSL
  max: 5, // free tier do Render free tem 512MB RAM, pool pequeno
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, migrate };
```

### 5. Substituir `db.json` por queries SQL em `sync.js`

**Onde**: `server/sync.js`.

#### 5a. No topo (depois de `require`s):
- **Remover**: `DB_FILE`, `db = { usuarios: [], pedidos: [], lojas: [] }`, `loadDb()`, `saveDb()`
- **Adicionar**:
  ```js
  const { pool, migrate } = require('./db');
  ```

#### 5b. Antes do `server.listen()`:
- Adicionar:
  ```js
  migrate().then(() => console.log('[sync] schema ok')).catch(e => { console.error('[sync] migrate failed', e); process.exit(1); });
  ```

#### 5c. Em **cada rota de leitura**, substituir filtro em array por query SQL:

| Rota | Substituição |
|------|--------------|
| `GET /usuarios` | `SELECT id, nome, email, tipo FROM usuarios` |
| `POST /session` | `SELECT id, senha_hash FROM usuarios WHERE email = $1` (depois `bcrypt.compare`) |
| `GET /lojas` | `SELECT * FROM lojas WHERE motoboy_id = $1` |
| `GET /loja` | `SELECT l.id, l.nome, l.code, u.nome AS motoboy_nome FROM lojas l JOIN usuarios u ON u.id = l.motoboy_id WHERE l.code = $1` |
| `GET /lojas/pedidos` | `SELECT * FROM pedidos WHERE loja_code = $1 ORDER BY created_at DESC` |
| `GET /pedidos` | `SELECT * FROM pedidos WHERE ($1::text IS NULL OR motoboy_id = $1) ORDER BY created_at DESC` |

#### 5d. Em **cada rota de escrita**, substituir `db.X.push() / db.X.splice()` por `INSERT/UPDATE/DELETE`:

| Rota | Query |
|------|-------|
| `POST /usuarios` | `INSERT INTO usuarios (id, nome, email, senha_hash, tipo) VALUES ($1, $2, $3, $4, $5)` — `senha_hash = bcrypt.hash(senha, 10)` |
| `POST /lojas` | `INSERT INTO lojas (id, motoboy_id, nome, code) VALUES ($1, $2, $3, $4)` |
| `POST /pedidos` | `INSERT INTO pedidos (id, motoboy_id, motoboy_nome, loja_code, comanda_numero, ..., historico) VALUES ($1, $2, ..., $N)` — `historico = JSON.stringify([{status:'pendente',timestamp:now}])` |
| `PATCH /pedidos/:id` | `UPDATE pedidos SET status = $1, sub_status = $2, updated_at = now(), historico = historico || $3::jsonb WHERE id = $4` |
| `DELETE /pedidos/:id` | `DELETE FROM pedidos WHERE id = $1` |
| `DELETE /pedidos` | `TRUNCATE pedidos` (só usado em dev) |

#### 5e. Conversão de campo de data:
- O JSON antigo guardava datas como ISO strings. O Postgres retorna `TIMESTAMPTZ` como objetos `Date`.
- O cliente (`api.ts`) já tem `normalizePedido()` que converte pra `new Date()` — não muda.
- Nas **respostas** que voltam pelo JSON, mudar os nomes dos campos de camelCase pra snake_case, OU adicionar uma função `rowToPedido(row)` que converte `cliente_nome` → `clienteNome` etc.

### 6. Configurar env vars no Render

**Onde**: Render dashboard → `motozap` service → Environment.

Adicionar:
- `DATABASE_URL_POOL` = `postgresql://neon:xxx@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` (a string pooled)
- `DATABASE_URL_DIRECT` = `postgresql://neon:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require` (a direct)

Manter:
- `NODE_VERSION` = 20
- `CI` = 1

**Não** deletar `db.json` ainda — ver step 8.

### 7. Atualizar `render.yaml` para incluir as deps

**Onde**: `render.yaml`.

```yaml
buildCommand: "npm install --no-audit --no-fund && npx expo export --platform web"
```

Não muda — `npm install` lê `package.json` e pega `pg` + `bcrypt` automaticamente.

### 8. Migração de dados existentes (opcional, mas importante)

**Onde**: novo arquivo `server/migrate-from-json.js` (script one-off, não roda em produção).

Lê o `server/db.json` local (com os dados que o usuário tem hoje — se tiver algum) e faz `INSERT` em cada registro, **re-hashando a senha** com bcrypt.

Roda **manualmente** uma vez, antes do primeiro deploy em produção:
```bash
DATABASE_URL_DIRECT=postgresql://... node server/migrate-from-json.js
```

Como o `db.json` local tem poucos registros (e o Render já resetou tudo), pode ser **skip-able**. Deixar o script no repo pra quem quiser usar no futuro.

### 9. Verificação

Após deploy, testar:

```bash
# Health
curl https://motozap.onrender.com/health
# → "ok"

# Criar usuário
curl -X POST https://motozap.onrender.com/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Test","email":"test@neon.com","senha":"abc123","tipo":"motoboy"}'
# → 201 com {id, nome, email, tipo}

# Login (verifica bcrypt)
curl -X POST https://motozap.onrender.com/session \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neon.com","senha":"abc123"}'
# → 200 com {userId}

# Verificar no Neon: SELECT email, senha_hash FROM usuarios WHERE email='test@neon.com';
# → senha_hash começa com "$2b$10$..." (bcrypt)

# Cold-start test: esperar 20 min sem requisição, depois logar de novo
# → deve continuar funcionando (dados persistem no Neon)
```

**No navegador**: abrir [https://motozap.onrender.com/login](https://motozap.onrender.com/login), cadastrar conta, esperar o cold start, logar de novo — usuário deve continuar existindo.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `package.json` | Adicionar `pg` e `bcrypt` em deps; `@types/pg` e `@types/bcrypt` em devDeps |
| `server/schema.sql` | **criar** — DDL das 3 tabelas |
| `server/db.js` | **criar** — pool + migrate() |
| `server/migrate-from-json.js` | **criar** — script one-off (opcional) |
| `server/sync.js` | Substituir `db.X.push/find/filter/splice/saveDb` por queries SQL; trocar `senha` plain por `senha_hash` bcrypt; adicionar `migrate()` no boot |
| `render.yaml` | Não muda (já roda `npm install`) |
| `plans/README.md` | Marcar como DONE após executar |

## Pontos a observar (risco)

- **bcrypt é CPU-intensive** (10 rounds = ~100ms por hash). Em Render free tier isso é OK, mas se virar gargalo, reduzir para `bcrypt.hash(senha, 8)`.
- **Neon free tier dorme após 5 min sem uso** (serverless). A primeira query após hibernação pode demorar ~500ms-2s. Isso é aceitável — pior caso o usuário vê um "Carregando..." por uns segundos.
- **JSONB em pedidos**: `historico` e `formas_pagamento` são arrays — armazenar como JSONB com `default '[]'::jsonb` é padrão Postgres e o `pg` lida nativamente.
- **`sslmode=require`**: Neon exige SSL. Já configurado no `db.js`.
- **`max: 5` no pool**: free tier do Render tem pouca RAM. Pool de 5 conexões é seguro.
- **Senhas antigas (texto puro)**: o `migrate-from-json.js` precisa chamar `bcrypt.hash` pra cada uma, senão o login vai quebrar. Se o usuário não tem dados importantes (já perdeu tudo no Render), pode skippar.

## Critério de done

- [ ] `npm install pg bcrypt` completa sem erro
- [ ] `server/schema.sql` aplicado com sucesso (tabelas criadas no Neon)
- [ ] `curl POST /usuarios` retorna 201 e o usuário aparece no Neon com `senha_hash` bcrypt
- [ ] `curl POST /session` com a senha correta retorna 200; com senha errada retorna 401
- [ ] Inspecionar `SELECT * FROM pedidos` no Neon após criar pedido via app: registro aparece
- [ ] Cold-start test: após 20 min sem requisição, dados ainda persistem (não foram perdidos)
- [ ] `render.yaml` deploy continua funcionando
- [ ] `plans/README.md` marca plano 006 como DONE

## STOP conditions

Parar e reportar se:
- Neon não provisionar conta (erro de cadastro)
- Conexão `pg` falha com erro diferente de SSL — pode ser firewall, IP allow list, ou string errada
- bcrypt dá erro de instalação em Render (raro, mas possível — alternativa é `bcryptjs` puro JS)
- Migration do schema falha (conflito de permissão, role sem CREATE TABLE)