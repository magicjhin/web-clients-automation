/**
 * Модуль: lead-select
 * Что делает: отбирает лиды из обогащённых компаний и создаёт записи в lead_delivery.
 *   - Фильтрует enrichment по lead_branch (A_bad_site / B_no_site)
 *   - Учитывает дедупликацию (blocked_until в lead_delivery)
 *   - Учитывает выбранные ниши подписчика (subscribers.selected_niches)
 *   - Пишет в lead_delivery + lead_state (bucket=active_lead)
 * Как запустить:
 *   npx tsx workers/lead-select/index.ts --limit=50
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'lead-select', ...args });
  log.info('lead-select stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'lead-select fatal error');
  process.exit(1);
});
