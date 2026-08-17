# Plano 005: Substituir autocomplete local por Google Maps nativo (igual iFood/Uber)

## Contexto

Tentamos 5 cascatas diferentes: offline → Google scraper → Photon → Nominatim → ViaCEP. Nenhuma confiável em 100% dos casos.

**O usuário pediu:** "use o Google ou Waze para achar as coordenadas igual o iFood ou outros apps fazem".

**Como iFood/Uber/Mercado Livre realmente fazem:** abrem o Google Maps nativo do celular, deixam o usuário escolher o endereço com a busca avançada do Google, e capturam o resultado via deep link reverso OU via clipboard share.

**Limitação descoberta:** o intent `geo:0,0?q=` da doc oficial do Android **NÃO retorna coordenadas ao app**. Pra ter retorno programático, precisa Google Places SDK (com API key paga).

**Solução prática e FREE que funciona AGORA:**

1. Botão "📍 Escolher no Google Maps" no app
2. Abre Google Maps nativo via `geo:0,0?q=<endereço cliente>` 
3. Motoboy toca no pino correto (que o Google já tem certinho)
4. Toca em "Compartilhar" → Google mostra lat/lon
5. Volta pro nosso app
6. Cola no botão "📋 Colar coordenadas" (paste do clipboard)
7. App preenche `clienteCoords` com lat/lon oficiais do Google

Esse fluxo é EXATAMENTE o que Waze, Uber, 99, iFood fazem quando não tem Places SDK. Funciona offline do nosso lado, usa o banco de dados REAL do Google, e o motoboy não precisa digitar nada.

## Mudança

### Arquivo único: `app/(app)/nova-entrega.tsx`

**Passo 1 — Adicionar imports** se não tiverem:

```typescript
import { Linking, Alert, Clipboard } from 'react-native';
```

**Passo 2 — Adicionar state pra coords coladas do clipboard:**

```typescript
const [coordenadasColadas, setCoordenadasColadas] = useState('');
```

**Passo 3 — Função `abrirGoogleMapsPraEscolher`:**

```typescript
const abrirGoogleMapsPraEscolher = async () => {
  if (!clienteEndereco || clienteEndereco.length < 5) {
    Alert.alert('Sem endereço', 'Digite o endereço do cliente primeiro');
    return;
  }
  // Abre o Google Maps nativo (deep link `geo:`) com busca pelo endereço
  // O motoboy toca no pino certo, depois "compartilhar" e copia lat/lon
  const url = `geo:0,0?q=${encodeURIComponent(clienteEndereco + ', Serra, ES')}`;
  try {
    await Linking.openURL(url);
  } catch {
    // Se Google Maps não estiver instalado, abre no navegador
    await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(clienteEndereco + ', Serra, ES')}`);
  }
  Alert.alert(
    'Volta com a coordenada',
    '1. Toque no pino correto no Google Maps\n' +
    '2. Toque em "Compartilhar"\n' +
    '3. Copie as coordenadas (formato: -20.198,-40.264)\n' +
    '4. Volte pro app e cole no campo abaixo'
  );
};
```

**Passo 4 — Função `colarCoordenadas` (lê clipboard, extrai lat/lon):**

```typescript
const colarCoordenadas = async () => {
  const texto = await Clipboard.getString();
  // Aceita "-20.198,-40.264" ou "-20.198, -40.264" ou "-20.198 -40.264"
  // ou URL completa tipo https://www.google.com/maps/@-20.198,-40.264,17z
  const match = texto.match(/(-?\d{1,3}\.\d+)[,\s]\s*(-?\d{1,3}\.\d+)/);
  if (!match) {
    Alert.alert('Formato inválido', 'Copie no formato: -20.198, -40.264');
    return;
  }
  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (Math.abs(lat) < 1 && Math.abs(lon) < 1)) {
    Alert.alert('Coordenada inválida', `${lat}, ${lon} não parece estar no Brasil`);
    return;
  }
  if (lat > -19 || lat < -21.5 || lon > -39.5 || lon < -41.5) {
    Alert.alert('Fora de Serra', `Lat ${lat}, Lon ${lon} está fora da região de Serra/ES. Confirma?`);
  }
  setClienteCoords({ lat, lon });
  setCoordenadasColadas(texto);
  // Atualiza distância
  const dist = await calcularDistanciaCoordenadas(lat, lon);
  if (dist) setDistancia(dist.distancia);
  // Atualiza rota
  const rotaResult = await buscarRota(lat, lon);
  if (rotaResult) setRota(rotaResult);
};
```

**Passo 5 — UI: substituir o dropdown atual por 2 botões grandes:**

Localizar onde está o `searchDropdown` (linha ~556) e substituir por:

```typescript
{/* Botões de escolha de endereço estilo iFood */}
{clienteEndereco && clienteEndereco.length >= 5 && (
  <View style={{ marginTop: 8, gap: 10 }}>
    <TouchableOpacity
      onPress={abrirGoogleMapsPraEscolher}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2196F3',
      }}
    >
      <Text style={{ fontSize: 22 }}>🗺️</Text>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontWeight: 'bold', color: '#1976D2' }}>Escolher no Google Maps</Text>
        <Text style={{ fontSize: 11, color: '#666' }}>Abre o Google Maps pra você tocar no pino certo</Text>
      </View>
    </TouchableOpacity>

    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      backgroundColor: '#FFF3E0',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#FF9800',
    }}>
      <Text style={{ fontSize: 22 }}>📋</Text>
      <TextInput
        placeholder="-20.198, -40.264 (cole do Google Maps)"
        value={coordenadasColadas}
        onChangeText={setCoordenadasColadas}
        style={{ flex: 1, marginLeft: 10, fontSize: 13 }}
      />
      <TouchableOpacity
        onPress={colarCoordenadas}
        style={{
          backgroundColor: '#FF9800',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Colar</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

**Passo 6 — Esconder o `searchDropdown` antigo** quando coords já estão coladas (evita duplicação). Ou simplesmente deletar o bloco antigo `showSearch && searchResults.length > 0`.

Pra esta entrega, vou DELETAR o bloco de autocomplete local antigo (linhas 622-643 do atual `nova-entrega.tsx`), porque o fluxo do Google Maps é melhor.

## Verificação

### Critério de sucesso

1. Tela "Nova Entrega": digita "Rua Pérola, 78"
2. Aparece:
   - Botão azul "🗺️ Escolher no Google Maps"
   - Campo "📋 Cole -20.198, -40.264 do Google Maps" + botão "Colar"
3. Toca no botão azul → Google Maps abre com a busca
4. Toca no pino certo → "Compartilhar" → copia coords
5. Volta pro app → toca "Colar" → lat/lon preenchidos, mapa centraliza no lugar certo
6. Distância calculada, rota exibida

### Comandos

```bash
adb shell am force-stop com.anonymous.MotoBoyApp
adb shell monkey -p com.anonymous.MotoBoyApp -c android.intent.category.LAUNCHER 1
```

Login `joao@teste.com / 123456` → "+ Nova Entrega" → testar fluxo acima.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/(app)/nova-entrega.tsx` | + botões Google Maps + Clipboard import + state + funções |

**Fora de escopo:**
- Não deletar `searchEnderecos` (Photon) nem o `handleSearchChange` — só esconder a UI
- Não mexer em outras telas
- Não adicionar dependência (`Clipboard` já vem com React Native)

## Hard rules

- NÃO adicionar API key do Google
- NÃO mexer no modal do mapa (mantém como 3ª opção)
- NÃO remover a barra de origem do endereço (CEP/mapa/manual)

## Manutenção

Se um dia adicionar **Google Places SDK** com API key: substituir `abrirGoogleMapsPraEscolher` pelo PlacePicker que retorna coords nativamente. Mesma interface de botão pro motoboy.
