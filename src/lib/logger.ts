/**
 * logger.ts — централизованный логгер (pino)
 *
 * В development: pino-pretty (цветной, читаемый вывод в терминал).
 * В production: JSON-строки (для сбора в Loki/Datadog или docker logs).
 *
 * Использование:
 *   import { logger } from '@/lib/logger';
 *   const log = logger.child({ module: 'rc-sync' });
 *   log.info({ companies: 100 }, 'Batch synced');
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    base: { service: 'leadgen-lt' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service',
        },
      })
    : undefined,
);
