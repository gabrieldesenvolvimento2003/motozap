---
name: whatsapp-nao-abre-ao-mudar-para-chegou
description: Botão Avançar muda status para "cheguei" mas WhatsApp não abre no APK. Causa: Linking.openURL está sendo chamado sem await, então a Promise é descartada antes do app nativo abrir, e em paralelo o Alert de "Entrega concluída" (linha 102) pode interferir.
---

# Plano: Corrigir abertura do WhatsApp ao mudar para "cheguei"

## Contexto

O usuário (motoboy) está testando no APK. Quando o pedido está em `a_caminho` e ele clica no botão "Avançar" para mudar para `cheguei`:

- ✅ Status muda para `cheguei` no servidor (visível no painel do lojista)
- ❌ WhatsApp **NÃO abre** com a mensagem "Seu pedido chegou!"

Quando muda para `saiu` e `a_caminho`, o WhatsApp **abre normalmente**. Só `cheguei` que falha.

## Causa raiz

Em `app/(app)/entrega/[id].tsx:78-115`, a função `atualizarStatus` chama `enviarMensagemStatus` sem `await`:

```typescript
if (notificarCliente && novoStatus !== 'pendente' && novoStatus !== 'cancelado') {
  if (!clienteTelefone) {
    Alert.alert('Sem telefone', 'Pedido sem telefone do cliente cadastrado.');
    return;                                          // ← ESTE return ABORTA o try inteiro
  }
  enviarMensagemStatus(novoStatus, clienteTelefone, ...);  // ← SEM await (fire-and-forget)
}
```

**Bug 1:** `enviarMensagemStatus` retorna uma Promise. Sem `await`, o JavaScript engine não espera o `Linking.openURL` completar — em alguns casos (Android em particular) o app nativo não abre se a Promise é descartada antes da intent ser despachada.

**Bug 2:** O `return` dentro do `if (!clienteTelefone)` aborta o try. Se `clienteTelefone` for falsy (string vazia, undefined), nada mais executa — mas isso é o comportamento desejado, não um bug. Foi adicionado nesta sessão para debug.

**Bug 3 (suspeito):** Dentro de `enviarMensagemStatus` (linha 137), há uma chamada duplicada de `.replace(/\D/g, '')` — primeiro na linha 132, depois na linha 141 com `clienteTelefone!`. Funciona, mas é redundante.

**Bug 4 (suspeito, principal):** No Android, `Linking.canOpenURL('whatsapp://send?...')` pode retornar `false` mesmo com WhatsApp instalado, dependendo do app target SDK. Quando retorna `false`, o código tenta abrir `https://wa.me/...` — isso abre o **navegador**, não o WhatsApp. No iOS funciona, no Android pode falhar.

## Correção

Adicionar `await` na chamada de `enviarMensagemStatus`, e usar URL `https://api.whatsapp.com/send?...` (que abre direto no WhatsApp mesmo no Android) como primário, com fallback para `whatsapp://`.

## Arquivo a modificar

`app/(app)/entrega/[id].tsx` — apenas duas regiões.

## Mudanças exatas

### Mudança 1 — Linha 104: adicionar await

```typescript
        enviarMensagemStatus(novoStatus, clienteTelefone, clienteNome, comandaNumero, valorPedido, valorTotal);
```

para:

```typescript
        await enviarMensagemStatus(novoStatus, clienteTelefone, clienteNome, comandaNumero, valorPedido, valorTotal);
```

### Mudança 2 — Linhas 140-148: usar URL universal como primário

Substituir o bloco:

```typescript
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(urlFallback);
        }
      } catch (e) {
        // Se falhar, tenta o fallback diretamente
        try {
          await Linking.openURL(urlFallback);
        } catch (e2) {
          Alert.alert('Erro', 'Não foi possível abrir o WhatsApp');
        }
      }
```

por:

```typescript
      // Tenta primeiro whatsapp://send (funciona no iOS, em alguns Android)
      try {
        await Linking.openURL(url);
      } catch {
        // Fallback universal: api.whatsapp.com (funciona em todos os Androids modernos)
        try {
          await Linking.openURL(urlFallback);
        } catch {
          Alert.alert('Erro', 'Não foi possível abrir o WhatsApp');
        }
      }
```

A URL `https://wa.me/55${tel}?text=...` abre direto no WhatsApp em qualquer Android moderno (sem precisar de intent nativo). É o padrão recomendado pela Meta.

## Verificação

```bash
# 1. Recarregar o APK no celular
adb install -r MotoBoyApp-debug.apk

# 2. Criar pedido teste com telefone (27999999999)
# 3. Avançar: pendente → saiu (deve abrir WhatsApp com msg "Em Rota")
# 4. Avançar: saiu → a_caminho (deve abrir WhatsApp com msg "A Caminho")
# 5. Avançar: a_caminho → cheguei (DEVE abrir WhatsApp com msg "Seu pedido chegou!")
```

## Critérios de done

- [ ] Avançar para `saiu` abre WhatsApp com mensagem de EM ROTA
- [ ] Avançar para `a_caminho` abre WhatsApp com mensagem de A CAMINHO
- [ ] Avançar para `cheguei` abre WhatsApp com mensagem de CHEGOU (este é o bug que estava falhando)
- [ ] Avançar para `entregue` abre WhatsApp com mensagem de ENTREGA REALIZADA

## Risco

Baixo. Adicionar `await` em uma chamada que já retorna Promise não muda comportamento esperado. Trocar ordem de fallback é cosmético no iOS e melhora no Android.

## Não vou modificar

- A estrutura do botão Avançar (linha 525-552) — está funcionando
- A lógica de sub-status (contatando, contato_ok, cobrando) — não está relacionada
- A exibição do sub-status no header do card (linha 329-341) — funciona
- O `STATUS_LABELS` (linha 22-32) — só encurtamos os textos pra caber no chip

## Dependências

Nenhuma. Esta é uma correção isolada.