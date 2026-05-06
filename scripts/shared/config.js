// МОДУЛЬ: shared/config.js
// ЧТО: Загрузка переменных окружения из .env, валидация
// КАК ИСПОЛЬЗОВАТЬ: const config = require('./shared/config');

require('dotenv').config();

const required = [
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length && process.env.SKIP_ENV_CHECK !== 'true') {
    console.warn(`[config] Missing env vars: ${missing.join(', ')}`);
}

module.exports = {
    db: {
        url: process.env.DATABASE_URL,
    },
    claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-sonnet-4-6',
    },
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },
    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.FROM_EMAIL,
        fromName: process.env.FROM_NAME,
    },
    imap: {
        host: process.env.IMAP_HOST,
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS,
    },
    google: {
        mapsKey: process.env.GOOGLE_MAPS_API_KEY,
        pagespeedKey: process.env.PAGESPEED_API_KEY,
    },
    settings: {
        batchSize: parseInt(process.env.BATCH_SIZE || '15', 10),
        followupDays: parseInt(process.env.FOLLOWUP_DAYS || '3', 10),
        vipThreshold: parseInt(process.env.VIP_SCORE_THRESHOLD || '80', 10),
    },
};
