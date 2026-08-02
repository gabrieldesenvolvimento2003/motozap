# 🚀 Guia de Deploy no Render.com

## Passo 1: Instalar o Git
Baixe em: https://git-scm.com/download/win (instale normalmente)

## Passo 2: Criar conta no GitHub
1. Vai em https://github.com
2. Cria uma conta gratuita (ou faça login se já tem)

## Passo 3: Subir os arquivos

Abra o terminal na pasta do projeto e rode:

```bash
cd "C:\Users\gabri\OneDrive\Área de Trabalho\APP DE MOTOBOY"
git init
git add .
git commit -m "MotoZap Baileys Server"
```

Depois:
1. Vai em https://github.com/new
2. Nome do repositório: `motozap-baileys`
3. **Privado** (importante!)
4. Clica em "Create repository"

No terminal, rode:
```bash
git remote add origin https://github.com/SEU_USUARIO/motozap-baileys.git
git branch -M main
git push -u origin main
```

(Vai pedir usuário e senha do GitHub)

## Passo 4: Deploy no Render

1. Vai em https://render.com e faça login
2. Clica em **"New +"** → **"Web Service"**
3. Clica em **"Connect a repository"** → procure `motozap-baileys`
4. Configura:
   - **Name**: `motozap-baileys`
   - **Region**: `Oregon (US West)`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node baileys-server.js`
   - **Instance Type**: **Free** ⬅️ IMPORTANTE
5. Clica em **"Advanced"** e adiciona variável de ambiente:
   - **Key**: `PORT`
   - **Value**: `10000`
6. Clica em **"Create Web Service"**

## Passo 5: Pegar a URL

Depois de uns 2-3 minutos, o Render vai mostrar uma URL tipo:
```
https://motozap-baileys.onrender.com
```

**Anote essa URL!** Você vai precisar dela.

## Passo 6: Escanear QR Code

1. No painel do Render, clica no seu serviço
2. Vai em **"Logs"**
3. Procura o **QR Code** (em texto/ASCII)
4. Escaneia com seu WhatsApp:
   - WhatsApp → 3 pontinhos → Dispositivos Vinculados → Vincular
5. Vai aparecer nos logs: **"WhatsApp conectado com sucesso!"**

## Passo 7: Configurar o app

Me manda a URL do Render que eu atualizo o app pra conectar nela!

---

## ⚠️ Importante sobre o plano grátis:

- O servidor **dorme após 15min sem uso**
- Quando alguém usa o app, ele **acorda sozinho** (demora ~30s na primeira vez)
- Plano grátis é **mais que suficiente** pra MotoZap
- Se precisar 24h sem dormir, podemos fazer upgrade depois

## 💡 Dica:

Se o servidor dormir, a primeira mensagem demora uns 30 segundos a mais. Depois volta ao normal.