// МОДУЛЬ: telegram/bot.js
// ЧТО: Telegram бот для управления системой лидогенерации
// КАК ЗАПУСТИТЬ: node scripts/telegram/bot.js (должен работать 24/7, запускается из n8n)
// Команды: /parse, /parse 1, /parse auto, /status, /help

const TelegramBot = require('node-telegram-bot-api');
const db = require('../shared/db');
const logger = require('../shared/logger');
const config = require('../shared/config');
const parser = require('../parser/index');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
const CHAT_ID = config.TELEGRAM_CHAT_ID;

// /start и /help
bot.onText(/\/start|\/help/, async (msg) => {
  const helpText = `
🤖 *Leadgen Bot* — управление системой лидогенерации

*Команды:*
📊 /parse — показать топ 5 ниш для парсинга
📊 /parse [1-50] — парсить конкретную нишу (напр. /parse 1)
🔄 /parse auto — автоматический парсинг (если < 100 qualified)

📈 /status — статус текущих процессов
📋 /stats — статистика компаний и ниш

❓ /help — эта справка
  `;

  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// /parse — показать топ 5 ниш
bot.onText(/^\/parse$/, async (msg) => {
  try {
    const result = await parser.listNiches();

    if (result.error) {
      bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
      return;
    }

    bot.sendMessage(msg.chat.id, result.message, { parse_mode: 'Markdown' });
  } catch (error) {
    await logger.log('error', 'telegram/bot', `Ошибка в /parse: ${error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
  }
});

// /parse [1-50] — парсить нишу
bot.onText(/^\/parse\s+(\d+)$/, async (msg, match) => {
  const nicheId = parseInt(match[1]);

  try {
    bot.sendMessage(msg.chat.id, `⏳ Начинаю парсинг ниши #${nicheId}... (может занять 5-30 минут)`);

    const result = await parser.parseNiche(nicheId);

    if (result.error) {
      bot.sendMessage(msg.chat.id, `❌ Ошибка: ${result.error}`);
    } else {
      const successMsg = `
✅ *Парсинг завершён!*
Ниша: *${result.niche}*
Найдено компаний: *${result.companiesFound}*
Новых: *${result.companiesNew}*

Следующий шаг: /filter
      `;
      bot.sendMessage(msg.chat.id, successMsg, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    await logger.log('error', 'telegram/bot', `Ошибка в /parse [id]: ${error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Ошибка при парсинге: ${error.message}`);
  }
});

// /parse auto — автоматический парсинг
bot.onText(/^\/parse\s+auto$/, async (msg) => {
  try {
    bot.sendMessage(msg.chat.id, `⏳ Запускаю автоматический парсинг...`);

    const result = await parser.parseAuto();

    if (result.error) {
      bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
    } else if (result.message) {
      bot.sendMessage(msg.chat.id, result.message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    await logger.log('error', 'telegram/bot', `Ошибка в /parse auto: ${error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
  }
});

// /status — статус системы
bot.onText(/\/status/, async (msg) => {
  try {
    const stats = await db.one(
      `
      SELECT
        (SELECT COUNT(*) FROM niches WHERE status = 'parsing') as parsing_niches,
        (SELECT COUNT(*) FROM niches WHERE status = 'completed') as completed_niches,
        (SELECT COUNT(*) FROM companies WHERE status = 'raw') as raw_companies,
        (SELECT COUNT(*) FROM companies WHERE status = 'qualified') as qualified_companies,
        (SELECT COUNT(*) FROM companies WHERE status = 'vip') as vip_companies
      `,
      []
    );

    const statusMsg = `
📊 *Статус системы:*

🔄 Парсинг:
  Ниш в процессе: ${stats.parsing_niches}
  Ниш завершено: ${stats.completed_niches}

📋 Компании:
  Raw (непроверенные): ${stats.raw_companies}
  Qualified (прошли фильтр): ${stats.qualified_companies}
  VIP: ${stats.vip_companies}
    `;

    bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
  } catch (error) {
    await logger.log('error', 'telegram/bot', `Ошибка в /status: ${error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
  }
});

// /stats — статистика
bot.onText(/\/stats/, async (msg) => {
  try {
    const stats = await db.many(
      `
      SELECT
        n.id,
        n.name,
        n.ai_rank,
        COUNT(CASE WHEN c.status = 'raw' THEN 1 END) as raw_count,
        COUNT(CASE WHEN c.status = 'qualified' THEN 1 END) as qualified_count,
        COUNT(CASE WHEN c.status = 'vip' THEN 1 END) as vip_count
      FROM niches n
      LEFT JOIN companies c ON n.id = c.niche_id
      GROUP BY n.id, n.name, n.ai_rank
      ORDER BY n.ai_rank
      LIMIT 10
      `,
      []
    );

    let statsMsg = '📈 *Топ 10 ниш по компаниям:*\n\n';
    stats.forEach(niche => {
      const total = niche.raw_count + niche.qualified_count + niche.vip_count;
      statsMsg += `[${niche.id}] ${niche.name}\n`;
      statsMsg += `  Raw: ${niche.raw_count} | Q: ${niche.qualified_count} | VIP: ${niche.vip_count}\n`;
    });

    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'Markdown' });
  } catch (error) {
    await logger.log('error', 'telegram/bot', `Ошибка в /stats: ${error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
  }
});

// Обработка ошибок бота
bot.on('polling_error', error => {
  logger.log('error', 'telegram/bot', `Polling error: ${error.message}`);
});

logger.log('info', 'telegram/bot', '✅ Telegram бот запущен и готов к командам');

module.exports = bot;
