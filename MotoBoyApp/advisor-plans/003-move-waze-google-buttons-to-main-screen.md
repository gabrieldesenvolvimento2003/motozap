# Plano 003: Mover botões Waze/Google Maps pra tela principal + mostrar endereço enviado

## Contexto

Usuário reportou "ainda não está funcionando". Imagem anterior mostrou Google Maps abrindo o endereço errado (R. José Freitas em vez de Valparaíso) — Waze/Google interpretaram o texto de modo diferente do esperado.

**Mas o problema REAL é de UX, não de geocoding:** os botões Waze/Google Maps existem em `app/(app)/nova-entrega.tsx:813,820`, porém estão **escondidos dentro do `<Modal>` do mapa** (linha 760+). O motoboy só vê esses botões se:
1. Clicar no ícone de mapa → abre o modal
2. Aí rolar até o final do modal → vê os botões

Resultado: na tela principal de "Nova Entrega" o motoboy **só vê o botão "Criar Entrega"** e um ícone de mapa. Não tem um botão direto "Abrir Waze com esse endereço".

## Mudança

### Arquivo único: `app/(app)/nova-entrega.tsx`

**Passo 1 — Adicionar botões Waze/Google na tela principal** ao lado (ou abaixo) do botão "Criar Entrega":

Localizar onde está o `<TouchableOpacity onPress={handleCriar}>` (botão verde "Criar Entrega") que fica visível na tela principal — geralmente perto de linha 700-740. Colar logo **acima** desse botão:

```tsx
{clienteEndereco && clienteEndereco.trim().length > 5 && (
  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
    <TouchableOpacity
      style={{
        flex: 1, paddingVertical: 14, borderRadius: 8,
        backgroundColor: '#33CCFF', alignItems: 'center',
      }}
      onPress={() => abrirNavegacao('waze')}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>🧭 Waze</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={{
        flex: 1, paddingVertical: 14, borderRadius: 8,
        backgroundColor: '#4285F4', alignItems: 'center',
      }}
      onPress={() => abrirNavegacao('google')}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>🗺️ Google Maps</Text>
    </TouchableOpacity>
  </View>
)}
```

**Passo 2 — Mostrar preview do endereço** que vai ser enviado (pra o motoboy confirmar visualmente o que o app externo vai pesquisar):

```tsx
{clienteEndereco && (
  <Text style={{ marginTop: 8, fontStyle: 'italic', color: '#888' }} numberOfLines={2}>
    🔎 Vai pesquisar: {destinoBase || enderecoCliente}
  </Text>
)}
```

A variável `destinoBase` é computada dentro de `abrirNavegacao`. Pra mostrar preview antes de tocar, extrair a lógica de limpeza pra uma função `montarEnderecoBusca()` e chamar dos dois lugares.

**Passo 3 — Refatorar `abrirNavegacao` pra usar função pura de limpeza:**

```typescript
const montarEnderecoBusca = (): string => {
  const endLimpo = (enderecoCliente || '')
    .replace(/comanda\s*[#:]?\s*\d+/gi, '')
    .replace(/\bpedido\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /serra/i.test(endLimpo) ? endLimpo : `${endLimpo}, Serra, ES`;
};
```

Depois `abrirNavegacao` chama `montarEnderecoBusca()`. Mais limpo e o passo 2 fica fácil.

## Verificação

### Critério de sucesso

Tela "Nova Entrega" depois de digitar qualquer endereço com 5+ chars:

1. Aparece um preview "🔎 Vai pesquisar: Rua Marataízes, 394, Valparaíso, Serra, ES"
2. **Botões grandes "🧭 Waze" e "🗺️ Google Maps"** visíveis na tela principal, sem precisar abrir modal
3. Tocar em qualquer um abre app externo pesquisando EXATAMENTE esse texto
4. Botão continua funcionando mesmo sem `clienteCoords` (geocode falhou)

### Comandos

```bash
adb shell am force-stop com.anonymous.MotoBoyApp
adb shell monkey -p com.anonymous.MotoBoyApp -c android.intent.category.LAUNCHER 1
```

Depois:
- Login com `joao@teste.com / 123456`
- Tela "Nova Entrega"
- Digitar "Rua Marataízes, 394, Valparaíso"
- Verificar preview e botões na tela principal sem abrir modal
- Tocar Waze → app Waze abre com pesquisa "Rua Marataízes, 394, Valparaíso, Serra, ES"

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/(app)/nova-entrega.tsx` (perto do handleCriar) | + botões Waze/Google na tela principal + preview |
| `app/(app)/nova-entrega.tsx` (função abrirNavegacao) | Refatorar pra usar `montarEnderecoBusca()` |

**Fora de escopo:**
- Não mexer em `geolocation.ts`
- Não mexer nos botões DENTRO do modal (podem ficar ou sair — não importa)
- Não adicionar dependência

## Hard rules

- NÃO mexer em Waze/Google dentro do modal (deixar como estão ou deletar)
- NÃO adicionar nova lib
- NÃO mexer no CSS além do necessário pros novos botões (inline mesmo)

## Manutenção

Quando o projeto ganhar coordenadas confiáveis (API paga do Google ou HERE), o botão Google já passa a usar lat/lon automaticamente (a função `abrirNavegacao` já tem o branch `if (clienteCoords)`).
