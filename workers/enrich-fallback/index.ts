/**
 * Модуль: enrich-fallback
 * Что делает: fallback-обогащение для компаний, не найденных через Places.
 *   - Парсит сайт компании напрямую (robots.txt, sitemap, og-tags)
 *   - Может использовать дополнительные источники (открытые реестры LT)
 *   - Обновляет enrichment.enrich_status = fallback_done
 * Как запустить:
 *   npx tsx workers/enrich-fallback/index.ts --limit=50 --batch=10
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'enrich-fallback', ...args });
  log.info('enrich-fallback stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'enrich-fallback fatal error');
  process.exit(1);
});
