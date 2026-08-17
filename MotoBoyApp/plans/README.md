# Plans — MotoBoyApp

Planos em ordem de prioridade. Cada um pode ser executado independente (com suas dependências listadas).

## Índice

| # | Plano | Status | Dependências | Custo |
|---|-------|--------|--------------|-------|
| 004 | [Deploy gratuito 24/7 — Railway + Vercel](./004-deploy-free-24h7.md) | DONE | Nenhuma | R$ 0 |
| 001 | [Envio automático de WhatsApp via Evolution API](./001-whatsapp-auto-notify.md) | Draft | Nenhuma | R$10-15/mês (chip) |
| 002 | [WhatsApp não abre ao mudar para "cheguei"](./002-whatsapp-chegou-fix.md) | Draft | Nenhuma | R$ 0 |
| 003 | [Corrigir overlay de detalhes do pedido no painel lojista](./003-overlay-detalhes-pedido.md) | Draft | Nenhuma | R$ 0 |

## Recomendação de execução

1. **004-deploy-free-24h7** — PRIORIDADE. Sem deploy, app não funciona fora da rede local. Railway + Vercel = R$0/mês, 24/7.
2. **003-overlay-detalhes-pedido** — bug visual P1: o modal de detalhes do pedido aparece quebrado após migração de `<Modal>` para `<Overlay>` CSS-only. 3 mudanças pequenas (~10 linhas). Corrigir antes de implementar o feature "Criar pedido", porque o `Overlay` virou o componente padrão de modal da app.
3. **001-whatsapp-auto-notify** — substituir abertura manual do WhatsApp por envio automático. Alto valor pro motoboy (1 tap a menos por status, cliente mais informado).

## Como executar um plano

```bash
# No Claude Code, dentro do diretório do projeto:
# Use o comando: /improve:improve execute <arquivo>
# Exemplo: /improve:improve execute plans/001-whatsapp-auto-notify.md
```

O executor vai:
1. Criar worktree isolado
2. Implementar todos os passos listados no plano
3. Rodar verificação
4. Devolver diff pra revisão
