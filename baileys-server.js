/**
 * MotoZap Baileys Server
 * Robo que envia WhatsApp automaticamente
 *
 * Como usar:
 * 1. Instale Node.js (nodejs.org)
 * 2. Abra terminal na pasta deste arquivo
 * 3. npm install baileys qrcode express cors
 * 4. node baileys-server.js
 * 5. Escaneie o QR Code com seu WhatsApp
 * 6. O robo fica rodando! Quando o app MotoZap mudar status,
 *    ele envia WhatsApp automatico pra loja
 */

const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(cors());

let sock = null;
let qrCodeDataUrl = null;

// Página HTML pro QR Code
app.get('/', (req, res) => {
  if (!qrCodeDataUrl) {
    return res.send('<h1>Aguardando QR Code...</h1><p>Espere um momento</p>');
  }
  res.send(`
    <html>
      <head>
        <title>MotoZap - WhatsApp Robo</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 40px; background: #111; color: white; }
          h1 { color: #FF6B00; }
          img { border: 4px solid #FF6B00; border-radius: 10px; margin: 20px 0; }
          .status { color: #4CAF50; font-size: 18px; margin: 20px 0; }
          .info { color: #888; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>🛵 MotoZap - Robo Ativo</h1>
        <div class="status">✅ Conectado e pronto!</div>
        <p class="info">O robo esta rodando. Pode minimizar esta janela.</p>
        <p class="info">MotoZap enviara mensagens automaticamente.</p>
      </body>
    </html>
  `);
});

// Endpoint pra ver QR Code (se precisar reconectar)
app.get('/qr', async (req, res) => {
  if (!qrCodeDataUrl) {
    return res.send('<html><body style="text-align:center;padding:40px;background:#111;color:white;font-family:Arial"><h1 style="color:#4CAF50">WhatsApp ja conectado!</h1><p>Nenhum QR Code necessario.</p></body></html>');
  }
  res.send(`<html><body style="text-align:center;padding:40px;background:#111;color:white;font-family:Arial">
    <h1 style="color:#FF6B00">Escaneie com WhatsApp</h1>
    <img src="${qrCodeDataUrl}" style="max-width:500px;background:white;padding:20px;border-radius:10px;" />
    <p>Abra WhatsApp > Dispositivos Vinculados > Vincular dispositivo</p>
  </body></html>`);
});

// API pra enviar mensagem
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!sock || !sock.user) {
    return res.status(500).json({ error: 'WhatsApp nao conectado. Escaneie o QR Code primeiro.' });
  }

  if (!phone || !message) {
    return res.status(400).json({ error: 'Falta phone ou message' });
  }

  try {
    // Limpa o telefone (só numeros)
    const cleanPhone = phone.replace(/\D/g, '');
    const jid = cleanPhone + '@s.whatsapp.net';

    await sock.sendMessage(jid, { text: message });
    console.log(`✅ Mensagem enviada pra ${phone}`);

    res.json({ success: true, to: phone });
  } catch (err) {
    console.error('❌ Erro ao enviar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Status do servidor
app.get('/status', (req, res) => {
  res.json({
    connected: !!sock?.user,
    phone: sock?.user?.id?.split('@')[0] || null
  });
});

async function connectWhatsApp() {
  console.log('🔄 Conectando ao WhatsApp...');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR Code no WhatsApp:\n');
      QRCode.toDataURL(qr).then(url => {
        qrCodeDataUrl = url;
      });
      // Mostra QR no terminal como ASCII
      QRCode.toString(qr, { type: 'terminal', small: true }, (err, qrText) => {
        if (!err) console.log(qrText);
      });
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp conectado com sucesso!');
      qrCodeDataUrl = null;
      // Mantém vivo pingando o WhatsApp a cada 30s
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      keepAliveInterval = setInterval(async () => {
        if (sock && sock.user) {
          try {
            await sock.sendPresenceUpdate('available');
            console.log('💓 Keepalive: WhatsApp ainda conectado');
          } catch (e) {
            console.log('⚠️ Keepalive falhou:', e.message);
          }
        }
      }, 30000);
    }

    if (connection === 'close') {
      console.log('\n⚠️ Conexao perdida.');
      qrCodeDataUrl = null;
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      // Detecta o tipo de erro
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== 401; // 401 = deslogado pelo usuário, não reconecta
      console.log('   Motivo:', reason, '| Reconectar?', shouldReconnect);
      if (shouldReconnect) {
        console.log('   Reconectando em 3s...');
        setTimeout(connectWhatsApp, 3000);
      } else {
        console.log('   Sessão expirada. Escaneie o QR Code novamente.');
      }
    }
  });
}

let keepAliveInterval = null;

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n🛵 MotoZap Server rodando na porta ${PORT}`);
  console.log(`📡 API: POST /send\n`);
  connectWhatsApp();
});
