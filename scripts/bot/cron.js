// МОДУЛЬ: bot/cron.js
// ЧТО: Cron планировщик — запускает pipeline задачи по расписанию
// КАК ИСПОЛЬЗОВАТЬ: const cron = require('./cron'); cron.start()

const cron = require('node-cron');
const { execFile } = require('child_process');
const path = require('path');
const { sendMessage } = require('./telegram');
const config = require('../shared/config');
const log = require('../shared/logger')('cron');

const SCRIPTS_DIR = path.join(__dirname, '..');

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const fullPath = path.join(SCRIPTS_DIR, scriptPath);
    execFile('node', [fullPath, ...args], { timeout: 300000 }, (error, stdout, stderr) => {
      if (error && error.code !== 0) {
        resolve({ error: stderr || error.message, stdout });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function notify(text) {
  try {
    await sendMessage(config.telegram.chatId, text);
  } catch (err) {
    console.error('[cron] Telegram notify failed:', err.message);
  }
}

async function runParser() {
  if (global.systemPaused) return;
  await log.info( 'Cron: запуск автопарсинга');
  const result = await runScript('parser/index.js', ['--auto']);
  const output = (result.stdout || '').trim();
  if (output) {
    await notify(`🕘 *Автопарсинг (09:00)*\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
  }
  if (result.error && !result.stdout) {
    await notify(`❌ Ошибка автопарсинга: ${result.error.slice(0, 500)}`);
  }
}

async function runFilter() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'filter/index.js');
  const fs = require('fs');
  if (!fs.existsSync(scriptPath)) {
    await log.info( 'Cron filter: скрипт не реализован, пропуск');
    return;
  }
  await log.info( 'Cron: запуск фильтрации');
  const result = await runScript('filter/index.js', ['--batch=10']);
  const output = (result.stdout || '').trim();
  if (output) {
    await notify(`🔍 *Фильтрация*\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
  }
  if (result.error && !result.stdout) {
    await notify(`❌ Ошибка фильтрации: ${result.error.slice(0, 500)}`);
  }
}

async function runAudit() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'audit/index.js');
  const fs = require('fs');
  if (!fs.existsSync(scriptPath)) {
    await log.info( 'Cron audit: скрипт не реализован, пропуск');
    return;
  }
  await log.info( 'Cron: запуск аудита');
  const result = await runScript('audit/index.js', ['--batch=5']);
  const output = (result.stdout || '').trim();
  if (output) {
    await notify(`🔎 *Аудит и письма*\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
  }
  if (result.error && !result.stdout) {
    await notify(`❌ Ошибка аудита: ${result.error.slice(0, 500)}`);
  }
}

async function runFollowup() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'email/followup.js');
  const fs = require('fs');
  if (!fs.existsSync(scriptPath)) {
    await log.info( 'Cron followup: скрипт не реализован, пропуск');
    return;
  }
  await log.info( 'Cron: запуск followup писем');
  const result = await runScript('email/followup.js', []);
  const output = (result.stdout || '').trim();
  if (output) {
    await notify(`📧 *Follow-up письма (10:00)*\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
  }
}

async function runImap() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'email/imap.js');
  const fs = require('fs');
  if (!fs.existsSync(scriptPath)) {
    return; // тихий пропуск — слишком частый cron
  }
  const result = await runScript('email/imap.js', []);
  if (result.error && !result.stdout) {
    await log.error(`IMAP ошибка: ${result.error.slice(0, 200)}`);
  }
}

function start() {
  // Ежедневно в 09:00 — автопарсинг
  cron.schedule('0 9 * * *', runParser, { timezone: 'Europe/Vilnius' });

  // Каждые 30 минут — фильтрация
  cron.schedule('*/30 * * * *', runFilter);

  // Каждые 30 минут (со сдвигом 15 мин) — аудит
  cron.schedule('15,45 * * * *', runAudit);

  // Ежедневно в 10:00 — follow-up письма
  cron.schedule('0 10 * * *', runFollowup, { timezone: 'Europe/Vilnius' });

  // Каждые 5 минут — проверка IMAP
  cron.schedule('*/5 * * * *', runImap);

  console.log('[cron] Cron планировщик запущен (5 задач)');
}

module.exports = { start };
