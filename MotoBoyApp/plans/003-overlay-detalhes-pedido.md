# Plan 003: Corrigir overlay de detalhes do pedido no painel lojista

> **Executor instructions**: Este plano resolve o bug visual do modal de detalhes do pedido no `app/lojista.tsx` após a migração de `<Modal>` (react-native-web) para um componente `<Overlay>` CSS-only. O erro de DOM `removeChild` foi eliminado, mas o overlay agora não sobrepõe o conteúdo da lista, o card de detalhes aparece colado no topo sem o sheet-bottom característico, e o `HistorySection` e o botão de fechar sumiram da renderização. Siga os passos. Run every verification. STOP se a realidade não bater com o "Current state".

> **Drift check (run first)**:
> `git diff --stat 3cb777f..HEAD -- app/lojista.tsx src/components/Overlay.tsx`
> Se houver diff, releia `app/lojista.tsx` e `src/components/Overlay.tsx` antes de prosseguir. Se o conteúdo de qualquer `Current state` excerpt abaixo não bater exatamente, pare e reporte.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3cb777f`, 2026-08-13
- **Issue**: N/A

## Why this matters

A migração de `<Modal>` para `<Overlay>` (commit atual) eliminou o erro `removeChild` que disparava ao abrir/fechar o modal de detalhes do pedido. Porém, o `<Overlay>` recém-criado em `src/components/Overlay.tsx` está sendo renderizado **dentro do mesmo `<View>` raiz** que contém o `FlatList` da lista de pedidos. No `react-native-web`, `position: absolute` apenas sobrepõe com sucesso o conteúdo se o pai tiver `position: relative` explícito OU se o overlay for posicionado com `top/left/right/bottom: 0` sobre um pai que ocupa 100% do viewport. Hoje o resultado é: a imagem da comanda invade a área de conteúdo (porque `<View style={styles.modalCard}>` sem maxHeight dentro do overlay vira 100% width × auto height, e a imagem de 200px aparece colada no topo), os botões e banner de status não aparecem porque a `View` pai do overlay tem `justifyContent: flex-end` mas o `bg` está `position: absolute` e em flex context com `FlatList` irmão, o que colapsa o flex do filho à esquerda.

Resultado para o usuário: o painel abre sem erro de DOM, mas ao tocar num pedido a UI fica quebrada — sem cabeçalho, sem banner de status, sem histórico, apenas a foto da comanda aparece no meio da lista.

## Current state

- `app/lojista.tsx:1-312` — a tela do painel lojista. Linha 9 importa `Overlay`. Linhas 237-309 renderizam o `<Overlay>` para `detalhePedido`. Linha 233-235 para `fotoZoom`.
- `src/components/Overlay.tsx:1-34` — novo componente. Renderiza `<View bg absolute>` com `dismiss` (TouchableOpacity) e `sheet` (View) filhos. Estilo `bg`: `position:absolute, top:0,left:0,right:0,bottom:0, backgroundColor rgba(0,0,0,0.5), justifyContent:flex-end, zIndex:9999`.
- O `<View>` raiz de `lojista.tsx:140` é `styles.container = { flex: 1 }`. No `react-native-web`, isso vira `flex: 1 1 0%` mas **sem `position: relative`** — net effect: filhos `position:absolute` dentro dele não clipam e podem "vazar" para fora do container, mas o `zIndex` normalmente ainda funciona se não houver `overflow:hidden` no ancestral.
- Sintoma visto no screenshot do usuário: card "📸 Comanda · toque pra ver" do pedido aparece no centro da viewport, sem o sheet modal por cima, sem banner de status, sem cabeçalho "📋 Pedido #X", sem ✕ de fechar.

Excerpt atual de `src/components/Overlay.tsx` (linhas 12-22):

```tsx
export default function Overlay({ visible, onClose, children, style }: Props) {
  if (!visible) return null;
  return (
    <View style={[styles.bg, style]} pointerEvents="box-none">
      <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}
```

Excerpt atual de `app/lojista.tsx` (linhas 233-235):

```tsx
<Overlay visible={!!fotoZoom} onClose={() => setFotoZoom(null)} style={styles.zoomBgOverride}>
  {fotoZoom && <Image source={{ uri: fotoZoom }} style={styles.zoomImg} resizeMode="contain" />}
</Overlay>
```

## Convention notes

- Estilos em `app/lojista.tsx` definem `styles.zoomBg`, `styles.zoomBgOverride`, `styles.modalBg`, `styles.modalCard` (linhas 357-361). O `modalCard` tem `maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40`. Mantenha esses estilos.
- O `useTheme()` retorna `colors` (objeto) — todos os componentes já seguem `style={{ backgroundColor: colors.surface }}`. Mantenha.
- O `setDetalhePedido(null)` é o fechamento; o `setFotoZoom(null)` é o fechamento do zoom. Os handlers `onClose` recebem isso.
- O `Overlay` deve substituir o `<Modal>` mas NÃO precisa de `visible` como `boolean` separado — mantenha a API atual `visible: boolean; onClose: () => void`.

## Commands you will need

| Purpose   | Command                                       | Expected on success |
|-----------|-----------------------------------------------|---------------------|
| Typecheck | `cd "MotoBoyApp" && npx tsc --noEmit`         | exit 0, no output   |
| Dev server | already running on `http://localhost:3000`   | HTTP 200 on `/lojista` |

(Reproduza a verificação visual no navegador após cada step não-TS.)

## Scope

**In scope** (the only files you should modify):
- `app/lojista.tsx` — adicionar `position: relative` ao `container` e ajustar onde o `Overlay` é montado
- `src/components/Overlay.tsx` — corrigir layout do `bg` e tornar o `sheet` realmente um bottom-sheet

**Out of scope** (do NOT touch):
- `src/services/pedidos.ts` — intocado, nenhum retorno de subscribe mudou
- `src/contexts/AuthContext.tsx` — não relacionado
- Qualquer outra tela (`app/(app)/*`, `app/login.tsx`) — não relacionado
- Remover o `<Overlay>` e voltar ao `<Modal>` — esta NÃO é a rota. O bug original do `removeChild` foi resolvido, mantenha o `<Overlay>`.

## Git workflow

- Branch: `advisor/003-overlay-bottom-sheet-fix`
- 1 commit por step lógico (Step 1, Step 2, depois 1 commit de cleanup)
- Mensagem em PT-BR, conventional commits: `fix(lojista): corrigir overlay de detalhes do pedido`

## Steps

### Step 1: Tornar o container do `lojista.tsx` em positioning context

Em `app/lojista.tsx`, localizar o `styles.container` (linha 315) e adicionar `position: relative`. Isso faz com que filhos `position:absolute` clippem dentro do viewport da tela, sem vazar para o `<body>`.

**Verify**: `cd "MotoBoyApp" && npx tsc --noEmit` → exit 0, no output.

### Step 2: Corrigir o `Overlay` para ser um bottom-sheet

Em `src/components/Overlay.tsx`, aplicar as 3 mudanças seguintes:

1. Adicionar `position: 'relative'` no `styles.bg` (defesa em profundidade, garante que ele seja o positioning context para `modalCard`).
2. No `styles.sheet`, adicionar `backgroundColor: 'transparent'` e `alignItems: 'stretch'`.
3. Trocar `pointerEvents="box-none"` por `pointerEvents="auto"` no View raiz — porque `box-none` faz filhos não receberem eventos, e o `TouchableOpacity` precisa receber eventos. Manter `pointerEvents="auto"` na `sheet` é o default.

Depois, **remover o `TouchableOpacity` de dismiss** — em vez disso, usar `Pressable` no View raiz com `onPress={onClose`, mas adicione `onStartShouldSetResponder` no `sheet` para evitar que toques no card fechem o modal. Implementação:

```tsx
return (
  <View style={[styles.bg, style]} onStartShouldSetResponder={() => true}>
    <Pressable style={styles.dismiss} onPress={onClose} />
    <View style={styles.sheet} onStartShouldSetResponder={() => true}>
      {children}
    </View>
  </View>
);
```

E atualizar o import para incluir `Pressable`:
```tsx
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
```

E remover o `TouchableOpacity` do import.

**Verify**: `cd "MotoBoyApp" && npx tsc --noEmit` → exit 0.

### Step 3: Garantir que o `modalCard` dentro do Overlay tenha altura mínima e aspecto de sheet

Em `app/lojista.tsx`, o `styles.modalCard` (linha 361) tem `maxHeight: '85%'` mas falta `minHeight` e `flexShrink: 0`. Em telas menores ou com `justifyContent: flex-end` no pai, o conteúdo pode colapsar. Adicionar `minHeight: 300` ao `modalCard`:

```tsx
modalCard: { maxHeight: '85%', minHeight: 300, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, width: '100%' },
```

Adicionar `width: '100%'` para garantir que o sheet ocupe toda a largura.

**Verify**: `cd "MotoBoyApp" && npx tsc --noEmit` → exit 0.

### Step 4: Verificação visual no navegador

1. Abra `http://localhost:3000/lojista` no navegador (não-cache: Ctrl+Shift+R).
2. Login `maria@lojista.com` / `1234`.
3. Toque em qualquer pedido da lista.
4. Confirme que aparece: cabeçalho "📋 Pedido #X" + ✕, banner de status colorido, seções (Cliente, Motoboy, Valores, Histórico), tudo dentro de um sheet que sobe do bottom com borda arredondada.
5. Toque no ✕ → modal fecha.
6. Toque fora do sheet (no fundo escuro) → modal fecha.
7. Toque na foto da comanda no card → modal de zoom abre, fundo 95% preto, imagem centralizada.

Se passos 4-7 falharem: o problema persiste e você precisa usar DevTools do navegador para inspecionar o DOM do overlay (clique direito em "Inspecionar" no `<View>` do sheet). Veja se `position: relative` do `container` aplicou e se o `sheet` está dentro do viewport.

## Test plan

- **Manual visual**: conforme Step 4. Não há testes automatizados para este projeto (verificado: zero arquivos `*.test.ts` ou `*.spec.ts`).
- Se Jest/configuração de testes for adicionada no futuro, o padrão seria: `src/components/__tests__/Overlay.test.tsx` cobrindo (a) não renderiza nada quando `visible=false`, (b) chama `onClose` quando o dismiss é tocado, (c) não chama `onClose` quando o sheet é tocado.

## Done criteria

ALL must hold:

- [ ] `npx tsc --noEmit` em `MotoBoyApp/` retorna exit 0 sem output
- [ ] No navegador, abrir pedido mostra sheet completo (cabeçalho, banner, seções, foto, ✕)
- [ ] Tocar ✕ fecha o modal
- [ ] Tocar fora do sheet fecha o modal
- [ ] Tocar dentro do sheet NÃO fecha o modal
- [ ] Zoom da comanda abre centralizado
- [ ] `git status` mostra apenas `app/lojista.tsx` e `src/components/Overlay.tsx` modificados
- [ ] `plans/README.md` tem uma linha nova para o plan 003 com status `DONE`

## STOP conditions

Stop and report back (do not improvise) if:

- O conteúdo de `app/lojista.tsx` ou `src/components/Overlay.tsx` em HEAD não bater com os excerpts em "Current state" (código pode ter mudado).
- Step 1 ou 2 falhar typecheck 2 vezes seguidas.
- A verificação visual em Step 4 mostrar que mesmo com `position: relative` no container, o overlay ainda vaza — nesse caso o problema é do `react-native-web` 0.21.x e exige escalate ao usuário (não implemente fallback com Portal nativo).
- O usuário pedir para reverter à `<Modal>` mesmo com o `removeChild` — escopo do advisor.
- Você descobrir que o `<Overlay>` foi removido por outro commit durante a execução.

## Maintenance notes

- O `Overlay` é agora o único modal da app. Se outra tela (`app/(app)/*`) ganhar um modal no futuro, importe este componente em vez de `<Modal>`.
- O `Pressable` no `Overlay` precisa do import correto de `react-native`. Verifique que `react-native` 0.81 expõe `Pressable` (sim, expõe).
- O `pointerEvents` no react-native-web é equivalente a `pointer-events` CSS. Mantenha o padrão atual.
- Se um dia migrar para React Native puro (celular), o `position: absolute` + `top:0/left:0/right:0/bottom:0` continua funcionando, e o `Pressable` é nativo. Nenhum ajuste extra necessário.
