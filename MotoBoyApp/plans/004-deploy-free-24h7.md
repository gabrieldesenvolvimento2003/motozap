# Plan 004: Deploy gratuito 24/7 — Railway + Vercel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `plans/README.md`.

> **Drift check (run first)**: `git diff --stat f42fa05..HEAD -- app/ src/ server/ package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `f42fa05`, 2026-08-16
- **Issue**: none

## Why this matters

O backend está rodando local (localhost:7777). O celular e o painel do lojista
precisam de um servidor público 24/7 para funcionar fora da rede local. Railway
gratuito + Vercel gratuito = R$0/mês, 500h/mês de uptime no Railway.

## Current state

- Repo local commitado em `f42fa05` mas remote quebrado (repo não existe no GitHub)
- `server/sync.js` — servidor Node, porta lida de `process.env.PORT || 7777`
- `src/services/api.ts` — `API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7777'`
- `app/painel.tsx` — `linkSite` usa `${API_BASE}/codigo?code=...`
- `app/codigo.tsx` — usa `${API_BASE}/loja?code=...`
- `app/lojista.tsx` — usa `${API_BASE}/lojas/pedidos?code=...`
- `src/services/geolocation.ts` — usa `${API_BASE}/geocode?...`
- **Sync server** está rodando local na porta 7777 (será desligado após deploy)
- APK existente em `../MotoBoyApp-debug.apk` — foi buildado com localhost, precisa rebuild

## Architecture

```
Browser/Celular (APK) ──→ Railway (backend: sync.js)
                              ↓
                          Vercel (frontend web: /codigo, /lojista, /painel)
```

- Railway: `node server/sync.js` — API pública em `https://<app>.up.railway.app`
- Vercel: `expo export` serve `/codigo`, `/lojista`, `/painel` — usa `EXPO_PUBLIC_API_URL`

## Steps

### Step 1: Criar repo GitHub

1. Abrir https://github.com/new
2. Nome: `motozap` (não marcar "Add a README")
3. Criar repo vazio
4. Copiar a URL SSH ou HTTPS (ex: `https://github.com/gabrielmda2003-stack/motozap.git`)

**Verify**: Repo aparece em https://github.com/gabrielmda2003-stack/motozap (vazio)

### Step 2: Conectar local ao GitHub

```bash
git remote set-url origin https://github.com/gabrielmda2003-stack/motozap.git
git remote -v
# deve mostrar origin com a URL acima
```

**Verify**: `git remote -v` mostra a URL do repo criado

### Step 3: Push para GitHub

```bash
git push -u origin main
```

**Verify**: `https://github.com/gabrielmda2003-stack/motozap` mostra os arquivos (app/, server/, src/, etc.)

### Step 4: Deploy Backend no Railway

1. Abrir https://railway.app → Login com GitHub
2. New Project → "Deploy from GitHub repo"
3. Selecionar repo `motozap`
4. Add a **NodeJS** service
5. Em **Settings** do service:
   - **Build Command**: `node server/sync.js` ( Railway detecta automatically )
   - **Start Command**: `node server/sync.js`
   - **Environment**: Production
6. Em Variables, Railway já define `PORT` automaticamente (usar porta 7777 ou deixar automático)
7. Deploy starta automaticamente

**Verify**: health check → `curl https://<railway-app-url>.up.railway.app/health` retorna `ok`

### Step 5: Deploy Frontend no Vercel

1. Abrir https://vercel.com → Login com GitHub
2. Import Project → selecionar repo `motozap`
3. Framework: **Expo**
4. Build Command: `npx expo export --platform web`
5. Output Directory: `dist`
6. Environment Variables:
   - `EXPO_PUBLIC_API_URL` = `https://<railway-app-url>.up.railway.app`
   - `EXPO_EXPORT_PLATFORM` = `web`
7. Deploy

**Verify**: `https://motozap.vercel.app` abre a tela de login

### Step 6: Atualizar painel.tsx linkSite (opcional, já usa API_BASE)

O `linkSite` em `app/painel.tsx` já usa `${API_BASE}/codigo?code=...`.
Em produção, `API_BASE` = URL Railway. Isso significa que o link do WhatsApp
aponta para o site Vercel, não Railway. Verificar que tudo funciona:

```bash
# No painel do motoboy logado:
# Criar loja → Copiar código → Abrir link no navegador
# Deve abrir https://motozap.vercel.app/codigo?code=<codigo>
```

Se o link mostrar a URL Railway ao invés de Vercel, ajustar para:
```typescript
const linkSite = (code: string) =>
  `https://motozap.vercel.app/codigo?code=${code}`;
```
(Usar domínio fixo do Vercel, não API_BASE, porque API_BASE = backend e linkSite = frontend)

**Verify**: Link enviado pelo WhatsApp abre a tela de validação de código

### Step 7: Rebuild APK com URL de produção

Após ter a URL Railway, rebuild do APK:

```bash
cd MotoBoyApp
# Verificar que package.json tem scripts android
npx expo run:android --variant release
# Ou: eas build --platform android --local (se EAS CLI instalado)
```

Se EAS não configurado, usar método direto:
```bash
cd android
./gradlew assembleRelease
```

O APK gerado em `android/app/build/outputs/apk/release/` terá a env var
`EXPO_PUBLIC_API_URL` configurada. **Antes do build**, criar `app.env`:
```
EXPO_PUBLIC_API_URL=https://<railway-app-url>.up.railway.app
```

**Verify**: APK instala no celular e conecta no backend em produção (não localhost)

## Test plan

- Backend: `curl https://<railway-url>/health` → `ok`
- Backend: `curl https://<railway-url>/usuarios` → `[]` (array vazio)
- Frontend web: `https://motozap.vercel.app` → tela de login
- Frontend web: `https://motozap.vercel.app/codigo` → tela de código do lojista
- Painel motoboy logado → criar loja → código gerado
- Celular (APK produção) → login motoboy → pedidos aparecem

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git push origin main` sucesso
- [ ] Railway: `curl <railway-url>/health` → `ok`
- [ ] Vercel: `https://motozap.vercel.app` carrega sem erro
- [ ] `https://motozap.vercel.app/codigo` abre tela de validação
- [ ] Link do WhatsApp no painel abre página de código no Vercel
- [ ] Motoboy logado consegue criar loja e ver o código
- [ ] Lojista acessa `/codigo?code=X` e entra no painel da loja
- [ ] APK de produção (se rebuildado) conecta no Railway

## STOP conditions

Stop and report back if:

- Railway deploy falha e o erro não é resolvido em 2 tentativas
- Vercel build falha (provavelmente precisa de `npx expo prebuild` ou ajustes no metro)
- Repo GitHub não é encontrado após criação (erro 404 no push)
- O APK não conecta no backend e o problema não é só a URL (verificar health)

## Maintenance notes

- Railway free tier = 500h/mês. Se o servidor dormir por inatividade,
  a primeira requisição pode demorar ~30s (cold start).
- Vercel free tier = 100h/mês de serverless execution, mas frontend static
  é ilimitado.
- Se Railway dormir, o APK vai mostrar erro de conexão. Voce pode usar
  Render.com como alternativa free (750h/mês) se Railway não bastar.
- `server/db.json` é o banco. Em produção Railway, dados persistem no disco
  efêmero — se Railway fizer redeploy, dados são resetados. Para persistência
  real, adicionar PostgreSQL no Railway (free tier 1 database).
