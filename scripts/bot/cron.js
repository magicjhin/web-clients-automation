// МОДУЛЬ: bot/cron.js
// ЧТО: Cron планировщик — запускает pipeline задачи по расписанию
// КАК ИСПОЛЬЗОВАТЬ: const cron = require('./cron'); cron.start()

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { sendMessage } = require('./telegram');
const config = require('../shared/config');
const log = require('../shared/logger')('cron');

const SCRIPTS_DIR = path.join(__dirname, '..');

async function notify(text) {
  try {
    await sendMessage(config.telegram.chatId, text);
  } catch (err) {
    console.error('[cron] Telegram notify failed:', err.message);
  }
}

// Запускает execFile-скрипты с таймаутом (только для быстрых задач)
function runScript(scriptPath, args = []) {
  const { execFile } = require('child_process');
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

async function runParser() {
  if (global.systemPaused) return;

  // Парсер вызывается напрямую (не через execFile) — он может работать часами
  const parser = require('../parser/index');
  const { getParseState } = parser;

  // Не запускать если уже идёт парсинг
  const state = getParseState();
  if (state.active) {
    await log.info('Cron parser: парсинг уже запущен, пропуск');
    return;
  }

  await log.info('Cron: запуск автопарсинга (00:00)');
  await notify('🌙 *Ночной автопарсинг запущен* (00:00)');

  try {
    const result = await parser.parseAuto();
    if (result.success) {
      await notify(`✅ *Автопарсинг завершён*\n${result.message}`);
    } else if (result.error) {
      await notify(`❌ *Ошибка автопарсинга:* ${result.error}`);
    } else if (result.message) {
      await notify(`ℹ️ *Автопарсинг:* ${result.message}`);
    }
  } catch (err) {
    await log.error(`Cron parser error: ${err.message}`);
    await notify(`❌ *Критическая ошибка автопарсинга:* ${err.message}`);
  }
}

async function runFilter() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'filter/index.js');
  if (!fs.existsSync(scriptPath)) {
    await log.info('Cron filter: скрипт не реализован, пропуск');
    return;
  }
  await log.info('Cron: запуск фильтрации');
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
  if (!fs.existsSync(scriptPath)) {
    await log.info('Cron audit: скрипт не реализован, пропуск');
    return;
  }
  await log.info('Cron: запуск аудита');
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
  if (!fs.existsSync(scriptPath)) {
    await log.info('Cron followup: скрипт не реализован, пропуск');
    return;
  }
  await log.info('Cron: запуск followup писем');
  const result = await runScript('email/followup.js', []);
  const output = (result.stdout || '').trim();
  if (output) {
    await notify(`📧 *Follow-up письма*\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
  }
}

async function runImap() {
  if (global.systemPaused) return;
  const scriptPath = path.join(SCRIPTS_DIR, 'email/imap.js');
  if (!fs.existsSync(scriptPath)) {
    return;
  }
  const result = await runScript('email/imap.js', []);
  if (result.error && !result.stdout) {
    await log.error(`IMAP ошибка: ${result.error.slice(0, 200)}`);
  }
}

function start() {
  // Ежедневно в 00:00 — автопарсинг (ночью, меньше нагрузки на сайт)
  cron.schedule('0 0 * * *', runParser, { timezone: 'Europe/Vilnius' });

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
