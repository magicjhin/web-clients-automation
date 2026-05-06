// МОДУЛЬ: shared/logger.js
// ЧТО: Запись логов в БД (logs) + console
// КАК ИСПОЛЬЗОВАТЬ: const log = require('./shared/logger')('parser');

const db = require('./db');

const LEVELS = ['info', 'warning', 'error', 'critical'];

function createLogger(module) {
    async function write(level, message, extra = {}) {
        const ts = new Date().toISOString();
        const line = `[${ts}] [${level.toUpperCase()}] [${module}] ${message}`;
        if (level === 'error' || level === 'critical') console.error(line);
        else console.log(line);

        try {
            await db.query(
                `INSERT INTO logs (level, module, message, stack_trace, company_id, niche_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    level,
                    module,
                    message,
                    extra.stack || null,
                    extra.companyId || null,
                    extra.nicheId || null,
                ]
            );
        } catch (err) {
            console.error('[logger] failed to write log to DB:', err.message);
        }
    }

    return {
        info: (msg, extra) => write('info', msg, extra),
        warn: (msg, extra) => write('warning', msg, extra),
        error: (msg, extra) => write('error', msg, extra),
        critical: (msg, extra) => write('critical', msg, extra),
    };
}

module.exports = createLogger;
