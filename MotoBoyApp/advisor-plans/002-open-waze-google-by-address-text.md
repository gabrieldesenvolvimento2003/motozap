# Plano 002: Pesquisar endereço direto no Waze/Google Maps (sem lat/lon)

## Contexto

O usuário desistiu de tentar geocodar a distância automaticamente. Depois de várias tentativas (offline, Photon, Nominatim, Google scraper, com filtro de bairro + número), nenhum método devolveu coordenadas confiáveis em todos os casos.

**Decisão do usuário (desta iteração):** "esqueça a distância, é só pesquisar no Google Maps ou no Waze o endereço que puxar do cliente e pronto."

Hoje existe `abrirNavegacao(app)` em `app/(app)/nova-entrega.tsx:390`, mas ele **exige `clienteCoords` com lat/lon**:

```typescript
if (!clienteCoords) {           // ← se nunca geocodificou, abre modal de mapa
  setMapModalOpen(true);
  return;
}
const { lat, lon } = clienteCoords;  // ← URL montada com lat/lon
const url = `waze://...ll=${lat},${lon}`;  // ou google.navigation?q=${lat},${lon}
```

O que o usuário quer: **botão que abre direto no app de mapa com o endereço TEXTO**, sem precisar de coords. O Waze e Google Maps aceitam search por texto via deep link.

## Mudança

### Arquivo único: `app/(app)/nova-entrega.tsx`

**Passo 1 — Reescrever `abrirNavegacao`** (linhas 387-413) pra aceitar busca por endereço:

```typescript
// Tenta abrir navegação nativa (Waze/Google) — primeiro por lat/lon se tiver
// coords, senão por endereço (texto). O app externo resolve as coordenadas.
const abrirNavegacao = async (app: 'waze' | 'google') => {
  const { latitude: oLat, longitude: oLon } = await Location.getCurrentPositionAsync({});
  const origin = `${oLat},${oLon}`;
  const destinoTexto = encodeURIComponent(enderecoCliente.trim());

  let url = '';
  if (app === 'waze') {
    // Waze aceita search por texto: waze://?q=endereco
    if (clienteCoords) {
      url = `waze://?ll=${clienteCoords.lat},${clienteCoords.lon}&navigate=yes`;
    } else {
      url = `waze://?q=${destinoTexto}&navigate=yes`;
    }
  } else {
    // Google Maps: ?q=endereco abre busca, depois motoboy toca "ir"
    if (clienteCoords) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${clienteCoords.lat},${clienteCoords.lon}&travelmode=driving`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${destinoTexto}`;
    }
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {}

  // Fallback web (se deep link falhar):
  const webFallback = app === 'waze'
    ? `https://waze.com/ul?q=${destinoTexto}&navigate=yes`
    : `https://www.google.com/maps/search/?api=1&query=${destinoTexto}`;
  await Linking.openURL(webFallback);
};
```

**Passo 2 — Garantir que o botão "Waze"/"Google" apareça mesmo SEM coords:**

Procurar onde o botão é renderizado (linha ~785) e remover qualquer condição `{clienteCoords && (...)}`. Sempre visíveis.

**Passo 3 — Remover dependência de `calcularDistancia` que ainda é chamada ao digitar endereço:**

Hoje `nova-entrega.tsx` chama `calcularDistancia()` (linha ~?) toda vez que o usuário termina de digitar (onChange debounced). Remover essa chamada automática — não precisa mais pra mostrar distância, e o pino só aparecia errado mesmo.

O `setDistancia` deve virar `null` por padrão. Se a geocoding retornar OK (raro agora), preenche. Senão, fica null.

## Verificação

### Critério de sucesso

App rodando, criar pedido com "Rua Marataízes, 394, Valparaíso, Serra - ES":

1. Botão **"Ir com Waze"** abre o app do Waze já com o endereço pesquisado e pronto pra navegar — **sem precisar arrastar pino no mapa do app**
2. Botão **"Ir com Google Maps"** faz o mesmo no Google Maps
3. App não trava, não mostra mapa em tela cheia, não exige interação com pino

### Comandos

```bash
# Metro + sync já devem estar rodando. Se não:
cd "C:/Users/gabri/OneDrive/Área de Trabalho/APP DE MOTOBOY/MotoBoyApp"
npx expo start &

cd server && node sync.js &

# Reload
adb shell am force-stop com.anonymous.MotoBoyApp
adb shell monkey -p com.anonymous.MotoBoyApp -c android.intent.category.LAUNCHER 1
```

Testar criar pedido, tocar botão Waze/Google → app externo abre com endereço.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/(app)/nova-entrega.tsx` (linhas 387–413) | Reescrever `abrirNavegacao` pra usar texto do endereço |
| `app/(app)/nova-entrega.tsx` (~linha 785) | Botões Waze/Google sempre visíveis |

**Fora de escopo:**
- `src/services/geolocation.ts` — pode permanecer, é fallback opcional
- Qualquer mudança em mapa, GPS, etc.

## Hard rules

- **NÃO** adicionar dependência
- **NÃO** deletar `geolocation.ts` (pode ser usado pra reverse geocoding do pino)
- **NÃO** mexer na tela de detalhes (`entrega/[id].tsx`)

## Manutenção

Quando o usuário decidir voltar a calcular distância (ex.: integração com HERE/Google API paga), basta reintroduzir `calcularDistancia` no `onChange` do TextInput e reusar `clienteCoords` se existir. A lógica do `abrirNavegacao` continua funcionando — por coords se houver, por texto se não.
