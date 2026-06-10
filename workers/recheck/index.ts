/**
 * Модуль: recheck
 * Что делает:
 *   Обходит ВСЕ компании с enrichment и расставляет их по трём вёдрам (lead_state):
 *     - dead         : company.status != 'active'  ИЛИ  enrich_status = 'archived_garbage'
 *     - active_lead  : enrich_status='rekvizitai_done'
 *                        AND credit_risk IN (A, B, C)
 *                        AND lead_branch IN (A_bad_site, B_no_site)
 *     - recheck_later: всё прочее обогащённое
 *   Для recheck_later: если enrichment.recheck_at пуст или уже прошёл — выставляет recheck_at = now + 90 дней.
 *   Для active_lead / dead: recheck_at НЕ трогаем (поле enrichment — только читаем, не мутируем логику).
 *
 * ПОЛИТИКА ВЁДЕР (фаза 1, согласовать позже):
 *   Приоритет проверки: dead > active_lead > recheck_later.
 *   active_lead = credit_risk строго A/B/C (как лид в дашборде); unknown → recheck_later.
 *   enrich_status='archived_garbage' всегда dead, независимо от company.status.
 *
 * НЕ МУТИРУЮТСЯ: enrich_status, lead_branch, credit_risk, website_status, places_*,
 *   review_status — ни одно поле enrichment (кроме опционального recheck_at).
 *   ре-энрич по наступлению recheck_at — НЕ реализован в этой итерации.
 *
 * // TODO (фаза 2): по due recheck_at → ставить enrich_status=pending для повторного прохода.
 *
 * Как запустить:
 *   npx tsx workers/recheck/index.ts                     # полный проход (124k+)
 *   npx tsx workers/recheck/index.ts --limit=1000        # ограничить N компаний
 *   npx tsx workers/recheck/index.ts --batch=200         # размер пачки (дефолт 500)
 *   npx tsx workers/recheck/index.ts --dry-run           # без записи в БД
 *
 * Зависит от: src/lib/db.ts (Prisma), src/lib/logger.ts (pino), workers/_runner.ts (CLI).
 * Секретов не использует (только чтение публичных полей БД).
 */

import type { Logger } from 'pino';
import type { Bucket, CreditRisk, EnrichStatus, CompanyStatus, LeadBranch, Prisma } from '@prisma/client';
import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

const log: Logger = logger.child({ module: 'recheck' });

// ─── Константы ────────────────────────────────────────────────────────────────

/** Через сколько дней выставляем следующую дату перепроверки для recheck_later. */
const RECHECK_DAYS = 90;

/**
 * Prisma select-объект для пачечного запроса. Выносим на уровень модуля —
 * это позволяет TypeScript вывести тип возвращаемых строк статически
 * (иначе при conditional spread внутри цикла возникает TS7022).
 */
const ENRICH_SELECT = {
  company_id: true,
  enrich_status: true,
  lead_branch: true,
  credit_risk: true,
  recheck_at: true,
  company: {
    select: { status: true },
  },
} as const;

type EnrichmentRow = Prisma.EnrichmentGetPayload<{ select: typeof ENRICH_SELECT }>;

/**
 * Кредит-риски лида = строго A/B/C — ровно как в дашборде (getLeads/getFunnelStats).
 * unknown НЕ считается лидом в кокпите → пусть падает в recheck_later (вёдра консистентны
 * с определением лида в остальном коде). D/E уже ушли в archived_garbage на этапе enrich.
 */
const GOOD_CREDIT: ReadonlySet<CreditRisk> = new Set<CreditRisk>(['A', 'B', 'C']);

// ─── Логика классификации ─────────────────────────────────────────────────────

interface EnrichRow {
  enrich_status: EnrichStatus;
  lead_branch: LeadBranch | null;
  credit_risk: CreditRisk | null;
  recheck_at: Date | null;
}

interface CompanyStatusRow {
  status: CompanyStatus;
}

/**
 * Определяет целевое ведро для компании.
 * Приоритет: dead > active_lead > recheck_later.
 */
function classifyBucket(company: CompanyStatusRow, enrich: EnrichRow): Bucket {
  // dead: компания снята с учёта или помечена мусором
  if (company.status !== 'active' || enrich.enrich_status === 'archived_garbage') {
    return 'dead';
  }

  // active_lead: завершено обогащение rekvizitai + хороший риск + ведущая ветка
  if (
    enrich.enrich_status === 'rekvizitai_done' &&
    enrich.credit_risk != null &&
    GOOD_CREDIT.has(enrich.credit_risk) &&
    (enrich.lead_branch === 'A_bad_site' || enrich.lead_branch === 'B_no_site')
  ) {
    return 'active_lead';
  }

  // всё прочее — перепроверить позже
  return 'recheck_later';
}

/**
 * Вычисляет новое значение recheck_at для ведра recheck_later.
 * Ставим дату только если текущая пуста или уже прошла (неразрушительно).
 */
function nextRecheckAt(current: Date | null): Date | null {
  const now = new Date();
  if (current === null || current <= now) {
    const next = new Date(now);
    next.setDate(next.getDate() + RECHECK_DAYS);
    return next;
  }
  return null; // дата ещё актуальна — не трогаем
}

// ─── Счётчики ─────────────────────────────────────────────────────────────────

interface Stats {
  processed: number;
  activeLead: number;
  recheckLater: number;
  dead: number;
  /** Строки lead_state, которые были созданы или изменили bucket. */
  changed: number;
  /** Строки enrichment.recheck_at, которые были обновлены. */
  recheckAtUpdated: number;
  skipped: number;
}

// ─── Основной прогон ──────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const args = parseArgs();
  const batchSize = args.batch > 0 ? args.batch : 500;
  const hardLimit = args.limit; // null = без лимита

  log.info(
    { batchSize, limit: hardLimit ?? 'unlimited', dryRun: args.dryRun },
    'recheck start',
  );

  const stats: Stats = {
    processed: 0,
    activeLead: 0,
    recheckLater: 0,
    dead: 0,
    changed: 0,
    recheckAtUpdated: 0,
    skipped: 0,
  };

  let cursor: string | undefined = undefined;
  let done = false;

  while (!done) {
    // Определяем размер пачки с учётом остатка до лимита
    const take = hardLimit !== null
      ? Math.min(batchSize, hardLimit - stats.processed)
      : batchSize;

    if (take <= 0) break;

    // Загружаем пачку: компании с enrichment, курсором по company_id.
    // Тип rows задан явно через EnrichmentRow[] — это разрывает цикл вывода TS7022.
    let rows: EnrichmentRow[];
    if (cursor) {
      rows = await db.enrichment.findMany({
        take,
        skip: 1,
        cursor: { company_id: cursor },
        orderBy: { company_id: 'asc' },
        select: ENRICH_SELECT,
      });
    } else {
      rows = await db.enrichment.findMany({
        take,
        orderBy: { company_id: 'asc' },
        select: ENRICH_SELECT,
      });
    }

    if (rows.length === 0) break;

    cursor = rows[rows.length - 1].company_id;
    if (rows.length < take) done = true; // последняя неполная пачка

    for (const row of rows) {
      stats.processed++;

      const enrich: EnrichRow = {
        enrich_status: row.enrich_status,
        lead_branch: row.lead_branch,
        credit_risk: row.credit_risk,
        recheck_at: row.recheck_at,
      };

      const targetBucket = classifyBucket(row.company, enrich);

      // Счётчики по вёдрам
      if (targetBucket === 'active_lead') stats.activeLead++;
      else if (targetBucket === 'recheck_later') stats.recheckLater++;
      else stats.dead++;

      if (args.dryRun) continue;

      // Upsert в lead_state — PrismaClient сам обновит last_change через @updatedAt
      const existing = await db.leadState.findUnique({
        where: { company_id: row.company_id },
        select: { bucket: true },
      });

      const bucketChanged = existing === null || existing.bucket !== targetBucket;
      if (bucketChanged) {
        await db.leadState.upsert({
          where: { company_id: row.company_id },
          create: { company_id: row.company_id, bucket: targetBucket },
          update: { bucket: targetBucket },
        });
        stats.changed++;
      }

      // Для recheck_later: обновляем recheck_at если нужно (НЕ мутируем прочие поля enrichment)
      if (targetBucket === 'recheck_later') {
        const newDate = nextRecheckAt(enrich.recheck_at);
        if (newDate !== null) {
          await db.enrichment.update({
            where: { company_id: row.company_id },
            data: { recheck_at: newDate },
          });
          stats.recheckAtUpdated++;
        }
      }
    }

    // Прогресс каждые ~5000 записей
    if (stats.processed % 5000 < batchSize) {
      log.info({ ...stats }, 'recheck progress');
    }
  }

  log.info(
    {
      processed: stats.processed,
      active_lead: stats.activeLead,
      recheck_later: stats.recheckLater,
      dead: stats.dead,
      changed: stats.changed,
      recheck_at_updated: stats.recheckAtUpdated,
      skipped: stats.skipped,
      dryRun: args.dryRun,
    },
    'recheck done',
  );

  await db.$disconnect();
}

run().catch((err) => {
  log.error(err, 'recheck fatal');
  process.exit(1);
});
