# Plano 004: Autocomplete iFood-style (do zero, sem geocoding mágico)

## Contexto

O usuário mostrou o print do **Google Places Autocomplete** no iFood e pediu pra fazer igual. Esquece cascata offline/scraper/Photon. Faz só:

1. Campo de texto "Endereço do cliente"
2. Cada keystroke → Photon devolve 5 sugestões (já existe `searchEnderecos` em `src/services/geolocation.ts:459`)
3. Lista embaixo do campo, igual Google Places:
   - Nome principal (rua, número)
   - Subtítulo (bairro, cidade - UF, cep)
4. Motoboy **toca** numa sugestão → preenche `clienteEndereco` + `clienteCoords` com lat/lon EXATOS do Photon
5. Sem isso: pede pra escrever no mapa (botão "📍 Ajustar no mapa") OU "Não achei meu endereço"

Isso é literalmente o fluxo do iFood: o motoboy **escolhe a sugestão certa** antes de criar o pedido. Não tem como coordenadas virem erradas porque **a sugestão vem com lat/lon** do Photon (que é alimentado pelo OpenStreetMap, mesma fonte do Waze/Google).

## Mudança

### Arquivo único: `app/(app)/nova-entrega.tsx`

**Passo 1 — Imports:** já tem `searchEnderecos` importado (linha 10). Não precisa mudar nada de import.

**Passo 2 — Acrescentar states:**

```typescript
const [sugestoes, setSugestoes] = useState<SearchResult[]>([]);
const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
const [showSugestoes, setShowSugestoes] = useState(false);
const buscaTimer = useRef<NodeJS.Timeout | null>(null);
```

**Passo 3 — Substituir o `<TextInput>` de clienteEndereco** pra disparar busca:

```typescript
<TextInput
  label="Endereço do cliente"
  value={clienteEndereco}
  onChangeText={(txt) => {
    setClienteEndereco(txt);
    // Debounce busca (300ms)
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    if (txt.trim().length < 4) {
      setSugestoes([]);
      setShowSugestoes(false);
      return;
    }
    buscaTimer.current = setTimeout(async () => {
      setBuscandoSugestoes(true);
      const results = await searchEnderecos(txt);
      setSugestoes(results);
      setShowSugestoes(results.length > 0);
      setBuscandoSugestoes(false);
    }, 300);
  }}
  onFocus={() => setShowSugestoes(sugestoes.length > 0)}
  onBlur={() => setTimeout(() => setShowSugestoes(false), 200)}
  mode="outlined"
  right={buscandoSugestoes ? <TextInput.Icon icon="magnify" /> : undefined}
/>

{/* Lista de sugestões (igual Google Places / iFood) */}
{showSugestoes && sugestoes.length > 0 && (
  <View style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, marginTop: 4 }}>
    {sugestoes.map((s, i) => (
      <TouchableOpacity
        key={i}
        style={{
          padding: 12,
          borderBottomWidth: i < sugestoes.length - 1 ? 1 : 0,
          borderBottomColor: '#eee',
          backgroundColor: '#fff',
        }}
        onPress={() => {
          // Preenche com o que o usuário escolheu + lat/lon do Photon
          setClienteEndereco(s.enderecoCompleto);
          setClienteCoords({ lat: s.lat, lon: s.lon });
          setShowSugestoes(false);
        }}
      >
        <Text style={{ fontWeight: 'bold' }}>{s.rua}{s.numero ? `, ${s.numero}` : ''}</Text>
        <Text style={{ fontSize: 12, color: '#666' }} numberOfLines={1}>
          {s.bairro ? `${s.bairro}, ` : ''}{s.cidade} - {s.estado} {s.enderecoCompleto.includes(',') ? '' : ''}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

**Passo 4 — Acrescentar botão "📍 Ajustar no mapa"** (mantém o modal do mapa como fallback):

```typescript
{clienteEndereco.length > 0 && (
  <Button onPress={() => setMapModalOpen(true)} mode="text" icon="map-marker">
    📍 Ajustar posição no mapa
  </Button>
)}
```

**Passo 5 — Remover chamadas automáticas de `calcularDistancia`** no `onChangeText` do endereço (linha ~300). A distância agora só calcula DEPOIS que motoboy escolhe sugestão ou ajusta mapa. Sem distância → botão Waze/Google mostra preview do endereço.

**Passo 6 — Preview do que vai pra Waze/Google** (linha ~700, perto de handleCriar):

```typescript
{clienteEndereco && (
  <Text style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 8 }}>
    🔎 Vai abrir com: "{clienteEndereco}"
  </Text>
)}
<View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
  <TouchableOpacity
    style={{ flex: 1, padding: 14, backgroundColor: '#33CCFF', borderRadius: 8, alignItems: 'center' }}
    onPress={() => abrirNavegacao('waze')}
  >
    <Text style={{ color: '#fff', fontWeight: 'bold' }}>🧭 Waze</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={{ flex: 1, padding: 14, backgroundColor: '#4285F4', borderRadius: 8, alignItems: 'center' }}
    onPress={() => abrirNavegacao('google')}
  >
    <Text style={{ color: '#fff', fontWeight: 'bold' }}>🗺️ Google Maps</Text>
  </TouchableOpacity>
</View>
```

## Verificação

### Critério de sucesso

Cenário: motoboy digita "rua perola 78 residencial" no campo:

1. Aparece lista iFood-style com 3-5 sugestões de "Rua Pérola" (incluindo a do Residencial Vista do Mestre)
2. Primeira opção: "Rua Pérola, 78" em destaque, subtítulo "Residencial Vista do Mestre, Serra - ES"
3. Tocar → campo preenche "Rua Pérola, 78, Residencial Vista do Mestre, Serra - ES, Brasil" + lat/lon do Photon
4. Aparece preview "🔎 Vai abrir com: Rua Pérola, 78, ..."
5. Botão "📍 Ajustar no mapa" se quiser arrastar pino
6. Botões Waze/Google na tela principal, abrem direto pesquisando o endereço (sem lat/lon se preferir)

### Comandos

```bash
adb shell am force-stop com.anonymous.MotoBoyApp
adb shell monkey -p com.anonymous.MotoBoyApp -c android.intent.category.LAUNCHER 1
```

Login `joao@teste.com / 123456` → "+ Nova Entrega" → testar.

**Mão na massa com curl pra confirmar Photon:**

```bash
curl -s 'https://photon.komoot.io/api/?q=rua+perola+78+residencial+vista&limit=5&bbox=-41.2,-21.4,-39.5,-19.2'
```

Esperado: feature com `name: "Rua Pérola"` e `district: "Residencial Vista do Mestre"`, lat=-20.198, lon=-40.265.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/(app)/nova-entrega.tsx` | + states + buscarSugestoes + lista + botões na tela principal + preview |

**Fora de escopo:**
- Não mexer em `geolocation.ts` (busca já funciona)
- Não mexer no modal do mapa (manter como fallback)
- Não deletar botões DENTRO do modal (podem ficar)

## Hard rules

- NÃO adicionar dependência nova
- NÃO mexer em CSS global
- NÃO mexer no `geolocation.ts`

## Manutenção

Quando integrar com **API paga do Google Places** (ou **HERE Maps free** com key), só trocar o provider dentro de `searchEnderecos`. A UI permanece igual — o componente de sugestões é provider-agnóstico.
