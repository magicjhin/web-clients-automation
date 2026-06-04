/**
 * Модуль: enrich
 * Что делает: обогащает компании через Google Places API — ищет сайт, телефон, рейтинг.
 *   - Берёт компании из `companies` со статусом enrich_status=pending
 *   - 1 Places-запрос на компанию, жёсткий стоп 5000/мес (таблица places_usage)
 *   - Матчинг по уверенности (high→auto_approved, medium→needs_review, low→reject)
 *   - Пишет в таблицу enrichment
 * Как запустить:
 *   npx tsx workers/enrich/index.ts --niche=41 --limit=100 --batch=50
 *   npx tsx workers/enrich/index.ts --dry-run
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts (GOOGLE_PLACES_API_KEY)
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'enrich', ...args });
  log.info('enrich stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'enrich fatal error');
  process.exit(1);
});
