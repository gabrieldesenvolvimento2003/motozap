# Plano: Corrigir geocoding do Motoboy app — coordenadas erradas pro bairro Valparaíso

## Contexto

O usuário reportou em múltiplas iterações que o mapa do app mostra o pino num endereço errado mesmo digitando o endereço correto do cliente (ex.: "Rua Marataízes, 394, Valparaíso, Serra - ES").

### Causa-raiz identificada (vestígios)

**Arquivo:** `src/services/geolocation.ts`, linha 25.

O banco offline de bairros de Serra/ES tem esta entrada errada:

```typescript
'valparaíso': { lat: -20.1950, lon: -40.2700, raio: 800 },
'valparaiso': { lat: -20.1950, lon: -40.2700, raio: 800 },
```

Quando o usuário digita qualquer endereço contendo "Valparaíso", `buscaOffline()` (linha 261) bate primeiro que **qualquer** outro recurso (ViaCEP, Google scraper, Photon, Nominatim). O pino vai pra `(-20.1950, -40.2700)` que é **genérico da redondeza**, não a rua.

### Verificação independente

Eu testei direto no Nominatim (sem API key, free):

```
https://nominatim.openstreetmap.org/search?q=Rua+Marataízes+394+Valparaíso+Serra+ES+Brasil&countrycodes=br
```

Retorna **exato**:

- Nome: `Rua Marataízes, Valparaíso, Região de Laranjeiras, Serra, ES`
- Coords: **`lat=-20.1980926, lon=-40.2649442`** ← CORRETO
- Bbox: `-20.1987..-20.1975, -40.2650..-40.2649` (rua EXATA)

Já implementei o filtro por bairro + Nominatim no código (commit atual). **Mas o offline de Valparaíso bloqueia** a chegada lá.

### Print do usuário confirmou

Tela "Minhas Entregas" mostra mapa de preview com pino em "**em direção a R. Pérola**" — outro bairro, NÃO Valparaíso. Distância 2.7 km quando deveria ser ~3.5–4.5 km (Valparaíso ↔ Laranjeiras).

## Mudança mínima

### Passo 1 — Remover (ou mover pra lista "rua-somente") as entradas erradas do offline

**Arquivo:** `src/services/geolocation.ts`, linhas 25–26.

Mudança:

```diff
- 'valparaíso': { lat: -20.1950, lon: -40.2700, raio: 800 },
- 'valparaiso': { lat: -20.1950, lon: -40.2700, raio: 800 },
```

**Por quê remover:** Sem o match offline, o cálculo cai pro Google scraper / Nominatim que retorna coords REAIS da rua (`-20.1980926, -40.2649442`), testado e funcionando.

**Por que NÃO corrigir as coords:** Não há coords únicas que representem Valparaíso como um todo (é um bairro extenso). Remover é mais honesto.

### Passo 2 — Validar o fallback funcionando

Quando o usuário digitar "Rua Marataízes, 394, Valparaíso, Serra - ES":

1. **Offline** → não acha (removido)
2. **Google scraper** → pega coords HTML do google.com/maps
3. **Photon** (se Google falhar) → filtra por bairro "Valparaíso" → retorna feature com `district: Valparaíso` → usa essa lat/lon
4. **Nominatim** (último recurso) → já testado, retorna exato

## Verificação

### Critério de sucesso

Tela do mapa na home com pedido "Rua Marataízes, 394, Valparaíso" deve mostrar pino em **`-20.1980926, -40.2649442`**, e a distância exibida deve ser **≥ 3.0 km** (correto Valparaíso↔Laranjeiras).

### Comandos

```bash
# 1. Levantar Metro
cd "C:/Users/gabri/OneDrive/Área de Trabalho/APP DE MOTOBOY/MotoBoyApp"
npx expo start &

# 2. Server sync (já deve estar rodando)
cd server && node sync.js &
curl -s http://localhost:7777/health   # → ok

# 3. Cell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:7777 tcp:7777
adb shell am force-stop com.anonymous.MotoBoyApp
adb shell monkey -p com.anonymous.MotoBoyApp -c android.intent.category.LAUNCHER 1

# 4. After login (joao@teste.com / 123456) e criar pedido:
adb logcat | grep -iE "geocode|google scrape"
# Expected:
#   [geocode] GOOGLE SCRAPE: { lat: -20.198..., lon: -40.264... }
#   OR
#   [geocode] ✅ PHOTON (district+num): -20.198, -40.265 Valparaíso
#   OR
#   [geocode] ✅ NOMINATIM: -20.198, -40.265 Valparaíso
```

### Critério de rejeição (pare e reporte)

Se após a mudança o pino continuar mostrando um ponto que NÃO é Valparaíso (lat entre **-20.20 e -20.18**, lon entre **-40.27 e -40.26**), o problema NÃO é o offline. Volte e investigue se:

- O Google scraper está retornando `null` (HTTP 429 ou bloqueio)
- O Photon está retornando `null` (sem internet)
- O usuário digitou o endereço de modo diferente (ex.: acentuação)

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `src/services/geolocation.ts` (linhas 25–26) | Remover 2 entradas de `BAIRROS` |

Nenhuma outra mudança necessária.

## Hard rules de aceite

- **NÃO** adicionar dependência nova
- **NÃO** mexer em Photon, Nominatim, Google scraper (esses já estão corretos)
- **NÃO** adicionar testes — escopo único = 2 linhas removidas

## Manutenção futura

Quando o app for pra produção, substituir o scraper + offline por chamada real à API do Google Maps (com a chave de API deles) ou HERE Maps (free tier). Aí a remoção desta entrada vira automática.
