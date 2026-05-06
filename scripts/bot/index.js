// МОДУЛЬ: bot/index.js
// ЧТО: Точка входа — Express сервер, Telegram webhook, cron планировщик
// КАК ЗАПУСТИТЬ: node scripts/bot/index.js

const https = require('https');
const express = require('express');
const config = require('../shared/config');
const logger = require('../shared/logger');
const telegram = require('./telegram');
const cron = require('./cron');

const app = express();
app.use(express.json());

global.systemPaused = false;

app.post('/webhook/telegram', async (req, res) => {
  res.sendStatus(200);
  try {
    await telegram.handleUpdate(req.body);
  } catch (err) {
    console.error('[webhook] Unhandled error:', err.message);
    await logger.log('error', 'bot', `Webhook error: ${err.message}`);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', paused: global.systemPaused, uptime: process.uptime() });
});

function registerWebhook() {
  const webhookUrl = `https://n8n.webvibe-lead.fun/webhook/telegram`;
  const body = JSON.stringify({ url: webhookUrl });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${config.telegram.token}/setWebhook`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok) {
          console.log(`[bot] Webhook зарегистрирован: ${webhookUrl}`);
        } else {
          console.error('[bot] Ошибка регистрации webhook:', result.description);
        }
        resolve(result);
      });
    });
    req.on('error', (err) => {
      console.error('[bot] Ошибка setWebhook:', err.message);
      resolve({ ok: false });
    });
    req.write(body);
    req.end();
  });
}

async function start() {
  const PORT = process.env.PORT || 5678;

  app.listen(PORT, () => {
    console.log(`[bot] Express сервер запущен на порту ${PORT}`);
  });

  await registerWebhook();

  cron.start();

  await logger.log('info', 'bot', 'Bot started successfully');

  await telegram.sendMessage(
    config.telegram.chatId,
    `🟢 *Leadgen Bot запущен*\n\nВерсия: Node.js webhook + cron\nWebhook: /webhook/telegram\n\nИспользуй /help для списка команд`
  );

  console.log('[bot] Бот запущен, webhook зарегистрирован, cron активен');
}

start().catch(async (err) => {
  console.error('[bot] Fatal startup error:', err.message);
  try {
    await logger.log('error', 'bot', `Fatal startup: ${err.message}`);
  } catch (_) {}
  process.exit(1);
});
