/**
 * Модуль: rc-sync
 * Что делает: синхронизирует компании из RC API (get.data.gov.lt) в таблицу `companies`.
 *   - Качает только действующие (veikiantis=1) компании постранично
 *   - Если указан --niche, фильтрует по evrk2_code (фильтрация в Postgres, не в API)
 *   - Upsert по rc_code: обновляет изменившиеся поля, не дублирует
 *   - Обновляет rc_synced_at при каждом прогоне
 * Как запустить:
 *   npx tsx workers/rc-sync/index.ts               # все ниши, лимит 100
 *   npx tsx workers/rc-sync/index.ts --niche=41    # только строительство
 *   npx tsx workers/rc-sync/index.ts --limit=5000 --batch=200
 *   npx tsx workers/rc-sync/index.ts --dry-run     # без записи в БД
 *
 * Зависит от:
 *   - src/lib/db.ts (Prisma client) — требует сгенерированного клиента (npm run db:generate)
 *   - src/lib/logger.ts (pino)
 *   - src/lib/config.ts (.env валидация)
 *   - docs/API_RC.md — описание эндпоинтов RC API
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

// TODO: реализация — агент backend-pipeline
// Этапы:
//   1. Получить список действующих компаний с RC API (постраничный fetch)
//   2. Нормализовать поля (evrk2_code, address, city и т.д.)
//   3. Upsert в таблицу companies через db (Prisma)
//   4. Логировать прогресс каждые N записей

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'rc-sync', ...args });

  log.info('rc-sync started (stub)');
  log.info({ args }, 'Parsed CLI args');

  if (args.dryRun) {
    log.warn('DRY RUN mode — no writes to DB');
  }

  // Stub: заглушка до реализации backend-pipeline агентом
  log.info('rc-sync stub complete — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'rc-sync fatal error');
  process.exit(1);
});
