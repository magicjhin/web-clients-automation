/**
 * Модуль: recheck
 * Что делает: повторная проверка лидов с истёкшим recheck_at.
 *   - Берёт лиды из lead_state (bucket=recheck_later) с recheck_at <= NOW()
 *   - Заново проверяет сайт, PageSpeed, активность компании
 *   - Обновляет enrichment и lead_state (active_lead / dead)
 *   - Запускается по cron раз в неделю
 * Как запустить:
 *   npx tsx workers/recheck/index.ts --limit=50
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'recheck', ...args });
  log.info('recheck stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'recheck fatal error');
  process.exit(1);
});
