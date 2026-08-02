# 🛵 MotoZap - Servidor Baileys (Gratuito)

Este servidor permite enviar mensagens WhatsApp **automaticamente** sem pagar nada!

## Como instalar e usar

### 1. Instale o Node.js
Baixe em: https://nodejs.org (escolha a versão LTS)

### 2. Abra o Terminal
No Windows: Pressione `Win + R`, digite `cmd` e pressione Enter.

### 3. Va ate a pasta do MotoZap
```bash
cd "C:\Users\gabri\OneDrive\Área de Trabalho\APP DE MOTOBOY"
```

### 4. Instale as dependencias
```bash
npm install
```

### 5. Inicie o servidor
```bash
npm start
```

### 6. Escaneie o QR Code
Vai aparecer um QR Code no terminal. Abra o WhatsApp no seu celular:
1. Toque nos tres pontinhos → **Dispositivos Vinculados**
2. Toque em **Vincular dispositivo**
3. Escaneie o QR Code

### 7. Pronto! 🎉
O robo está funcionando. Mantenha o terminal aberto enquanto usa o app.

---

## O que acontece agora

Quando você muda o status de um pedido no MotoZap:
1. O app envia uma mensagem pro servidor
2. O servidor (que está com WhatsApp conectado) envia automaticamente pra loja
3. **Você não precisa fazer nada!**

---

## Se o servidor não estiver rodando

O app MotoZap vai perceber e vai abrir o WhatsApp manualmente (wa.me). 
Funciona igual, só que manual.

---

## Dicas

- **Manter ligado**: O servidor precisa estar rodando quando você muda status
- **Reiniciar**: Se fechar o terminal, é só rodar `npm start` de novo
- **Reconectar**: Se perder a conexão, rode `npm start` novamente e escaneie o QR

## Precisa de ajuda?

O servidor vai mostrar mensagens no terminal dizendo o que está acontecendo:
- `🔄 Conectando...` = Iniciando
- `📱 Escaneie o QR Code...` = Escaneie com WhatsApp
- `✅ WhatsApp conectado!` = Tudo certo!
- `❌ Erro ao enviar...` = Verifique a internet
