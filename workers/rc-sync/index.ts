/**
 * Модуль: rc-sync
 * Что делает:
 *   1. Скачивает классификатор EVRK 2.1 (1771 записей) → строит карту UUID → kodas
 *   2. Листает активные компании из RC API (JuridinisAsmuo?veikiantis=1) по курсору
 *   3. Нормализует поля RC → companies: rc_code, name, evrk2_code/name, status, sector,
 *      legal_form, reg_date. address/city — null (нет в ja_asmenys; обогащение через JAR buveines — позже)
 *   4. Upsert в таблицу companies по rc_code (идемпотентно), обновляет rc_synced_at
 *   5. ВСЕГДА полный снимок активных. Нишевые выборки — в Postgres по индексу evrk2_code,
 *      а НЕ при заборе. --niche здесь игнорируется (иначе companies был бы неполным).
 *   6. Поддерживает --dry-run: не пишет в БД, только считает и логирует пример записи
 *
 * Как запустить:
 *   npm run worker:rc-sync                              # все активные (полный снимок)
 *   npm run worker:rc-sync -- --limit=5000 --batch=200
 *   npm run worker:rc-sync -- --dry-run --limit=50     # валидация без записи в БД
 *
 * Зависит от:
 *   - src/lib/db.ts   (Prisma client, npm run db:generate)
 *   - src/lib/logger.ts (pino)
 *   - docs/API_RC.md  — описание эндпоинтов и проверенный синтаксис
 */

import type { Logger } from 'pino';
import { Prisma } from '@prisma/client';
import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

// ─── Константы ───────────────────────────────────────────────────────────────

const RC_BASE = 'https://get.data.gov.lt';
const EVRK_URL = `${RC_BASE}/datasets/gov/lsd/cl/evrk2_1/EkonominesVeiklosRusis`;
const JA_URL = `${RC_BASE}/datasets/gov/lsd/cl/ja_asmenys/JuridinisAsmuo`;

/** Размер страницы при листании компаний */
const PAGE_SIZE = 200;

/** Таймаут для одного HTTP-запроса (мс) */
const FETCH_TIMEOUT_MS = 30_000;

/** Максимум ретраев на сетевые ошибки */
const MAX_RETRIES = 3;

/** Задержка между ретраями (мс) */
const RETRY_DELAY_MS = 2_000;

/** Логировать прогресс каждые N обработанных записей */
const LOG_EVERY = 500;

// ─── Типы ────────────────────────────────────────────────────────────────────

interface EvrkRecord {
  _id: string;
  kodas: string;
  pavadinimas_lt: string;
}

interface EvrkPage {
  _data: EvrkRecord[];
  _page: { next: string | null };
}

interface JaRecord {
  kodas: string;
  pavadinimas: string;
  veikiantis: number | null;
  evrk_2_1: { _id: string } | null;
  evrk_2_1_pavadinimas: string | null;
  sektorius: { _id: string } | null;
  nuosavybes_forma_pavadinimas: string | null;
  iregistruotas: string | null;
}

interface JaPage {
  _data: JaRecord[];
  _page: { next: string | null };
}

interface NormalizedCompany {
  rc_code: string;
  name: string;
  evrk2_code: string;
  evrk2_name: string;
  status: 'active';
  sector: string | null;
  legal_form: string | null;
  // address/city — null: в ja_asmenys адреса нет.
  // Обогащение адресом — позже через JAR buveines (gov/rc/jar/.../buveines).
  address: null;
  city: null;
  reg_date: Date | null;
  financials: typeof Prisma.JsonNull; // атрибут, заполнится позже из balanso_ataskaitos
}

// ─── HTTP-утилиты ────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string): Promise<unknown> {
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText} — ${url}`);
      }

      return await resp.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        logger.warn(
          { attempt, url, error: lastErr.message },
          `rc-sync: fetch failed, retry in ${RETRY_DELAY_MS}ms`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastErr ?? new Error(`fetch failed after ${MAX_RETRIES} retries: ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Классификатор EVRK ──────────────────────────────────────────────────────

/**
 * Скачивает весь классификатор EVRK 2.1 (1771 записей) за один запрос
 * и возвращает карту UUID → kodas.
 * limit(2000) > 1771 — гарантированно один запрос.
 */
async function buildEvrkMap(
  log: Logger,
): Promise<Map<string, string>> {
  const url = `${EVRK_URL}?limit(2000)`;
  log.info({ url }, 'rc-sync: downloading EVRK 2.1 classifier');

  const data = (await fetchWithRetry(url)) as EvrkPage;

  const map = new Map<string, string>();
  for (const row of data._data) {
    if (row._id && row.kodas) {
      map.set(row._id, row.kodas);
    }
  }

  log.info({ total: map.size }, 'rc-sync: EVRK map built');
  return map;
}

// ─── Нормализация ─────────────────────────────────────────────────────────────

function normalizeCompany(
  row: JaRecord,
  evrkMap: Map<string, string>,
): NormalizedCompany | null {
  // Пропускаем записи без rc_code или названия
  if (!row.kodas || !row.pavadinimas) return null;

  const evrkUuid = row.evrk_2_1?._id ?? null;
  const evrk2_code = evrkUuid ? (evrkMap.get(evrkUuid) ?? '') : '';
  const evrk2_name = row.evrk_2_1_pavadinimas ?? '';

  // Без EVRK кода запись не пишем — не сможем фильтровать по нише
  if (!evrk2_code) return null;

  const reg_date = row.iregistruotas ? new Date(row.iregistruotas) : null;

  return {
    rc_code: row.kodas,
    name: row.pavadinimas,
    evrk2_code,
    evrk2_name,
    status: 'active',
    // sektorius приходит как ref {_id} — UUID без текстового названия в этой модели.
    // Сохраняем UUID как строку-идентификатор.
    sector: row.sektorius?._id ?? null,
    legal_form: row.nuosavybes_forma_pavadinimas ?? null,
    // address/city — нет в ja_asmenys; обогатить позже через JAR buveines
    address: null,
    city: null,
    reg_date,
    financials: Prisma.JsonNull,
  };
}

// ─── Пагинация JuridinisAsmuo ─────────────────────────────────────────────────

/**
 * Строит URL для следующей страницы.
 * Spinta RQL: пагинация через page("cursor") — курсор в двойных кавычках.
 * base64 cursor содержит '=' → encodeURIComponent превращает их в %3D,
 * что позволяет Spinta правильно распарсить строку.
 * Проверено: page("WyIw...XQ%3D%3D") работает ✅
 */
function buildPageUrl(cursor: string | null, pageSize: number): string {
  if (!cursor) {
    return `${JA_URL}?veikiantis=1&limit(${pageSize})`;
  }
  const encodedCursor = encodeURIComponent(cursor);
  return `${JA_URL}?veikiantis=1&limit(${pageSize})&page("${encodedCursor}")`;
}

// ─── Upsert пачки в БД ────────────────────────────────────────────────────────

async function upsertBatch(
  batch: NormalizedCompany[],
  log: Logger,
): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;

  for (const company of batch) {
    try {
      await db.company.upsert({
        where: { rc_code: company.rc_code },
        create: {
          rc_code: company.rc_code,
          name: company.name,
          evrk2_code: company.evrk2_code,
          evrk2_name: company.evrk2_name,
          status: company.status,
          sector: company.sector,
          legal_form: company.legal_form,
          address: company.address,
          city: company.city,
          reg_date: company.reg_date,
          financials: company.financials,
          rc_synced_at: new Date(),
        },
        update: {
          name: company.name,
          evrk2_code: company.evrk2_code,
          evrk2_name: company.evrk2_name,
          status: company.status,
          sector: company.sector,
          legal_form: company.legal_form,
          // address/city не трогаем при update — могут быть обогащены позже через JAR buveines
          reg_date: company.reg_date,
          rc_synced_at: new Date(),
        },
      });
      upserted++;
    } catch (err) {
      errors++;
      log.error({ rc_code: company.rc_code, err }, 'rc-sync: upsert error');
    }
  }

  return { upserted, errors };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const log = logger.child({ module: 'rc-sync', ...args });

  log.info({ args }, 'rc-sync: started');

  if (args.dryRun) {
    log.warn('rc-sync: DRY RUN mode — no writes to DB');
  }

  // rc-sync ВСЕГДА тянет полный набор veikiantis=1 (полный снимок). Нишевые выборки — в Postgres
  // по индексу evrk2_code, а не при заборе. Поэтому --niche тут осознанно игнорируется.
  if (args.niche) {
    log.warn(
      { niche: args.niche },
      'rc-sync: --niche игнорируется — забор всегда полный (все активные); фильтр по нише делается в Postgres',
    );
  }

  // 1. Скачиваем классификатор EVRK → строим карту UUID → kodas
  const evrkMap = await buildEvrkMap(log);

  // 2. Листаем компании по курсору
  let cursor: string | null = null;
  let totalFetched = 0;    // всего строк от RC API
  let totalProcessed = 0;  // прошли нормализацию и (опционально) фильтр по нише
  let totalUpserted = 0;   // записаны/обновлены в БД (или counted в dry-run)
  let totalSkipped = 0;    // пропущены (нет evrk, нет kodas, не та ниша)
  let totalErrors = 0;     // ошибки upsert
  let firstExampleLogged = false;

  let batchAccum: NormalizedCompany[] = [];
  const seenCursors = new Set<string>(); // защита от зацикливания на повторяющемся курсоре

  outer: while (true) {
    // Guard: если RC вернул курсор, который уже обрабатывали — это спин (битый page-токен / баг API).
    // Падаем сразу, иначе rc-sync крутился бы вечно по одной странице.
    if (cursor !== null) {
      if (seenCursors.has(cursor)) {
        throw new Error('rc-sync: повторяющийся курсор пагинации — прерываю во избежание бесконечного цикла');
      }
      seenCursors.add(cursor);
    }

    const url = buildPageUrl(cursor, PAGE_SIZE);
    const page = (await fetchWithRetry(url)) as JaPage;

    if (!page._data || page._data.length === 0) {
      log.info('rc-sync: received empty page — done');
      break;
    }

    for (const row of page._data) {
      totalFetched++;

      // Проверяем лимит ДО обработки
      // Лимит применяется ТОЛЬКО если явно передан (--limit). Без него — полный снимок всех активных.
      if (args.limit !== null && totalProcessed >= args.limit) {
        log.info({ limit: args.limit }, 'rc-sync: --limit reached, stopping');
        break outer;
      }

      const normalized = normalizeCompany(row, evrkMap);

      if (!normalized) {
        totalSkipped++;
        continue;
      }

      // Логируем первый пример нормализованной записи
      if (!firstExampleLogged) {
        log.info({ example: normalized }, 'rc-sync: normalized record example');
        firstExampleLogged = true;
      }

      batchAccum.push(normalized);
      totalProcessed++;

      // Flush при заполнении пачки
      if (batchAccum.length >= args.batch) {
        if (!args.dryRun) {
          const result = await upsertBatch(batchAccum, log);
          totalUpserted += result.upserted;
          totalErrors += result.errors;
        } else {
          totalUpserted += batchAccum.length;
        }
        batchAccum = [];
      }

      // Лог прогресса каждые LOG_EVERY записей
      if (totalProcessed % LOG_EVERY === 0) {
        log.info(
          { processed: totalProcessed, upserted: totalUpserted, skipped: totalSkipped, errors: totalErrors },
          'rc-sync: progress',
        );
      }
    }

    // Переход на следующую страницу
    cursor = page._page?.next ?? null;
    if (!cursor) {
      log.info('rc-sync: reached last page');
      break;
    }
  }

  // Flush остатка пачки
  if (batchAccum.length > 0) {
    if (!args.dryRun) {
      const result = await upsertBatch(batchAccum, log);
      totalUpserted += result.upserted;
      totalErrors += result.errors;
    } else {
      totalUpserted += batchAccum.length;
    }
  }

  log.info(
    {
      fetched: totalFetched,
      processed: totalProcessed,
      upserted: totalUpserted,
      skipped: totalSkipped,
      errors: totalErrors,
      dryRun: args.dryRun,
    },
    'rc-sync: completed',
  );

  if (!args.dryRun) {
    await db.$disconnect();
  }

  // Ненулевой exit при ошибках upsert — иначе cron/CI/Actions сочтут провальный прогон успешным
  // (БД легла / миграция кривая / mismatch типов → ничего не записали, но exit 0).
  if (totalErrors > 0) {
    throw new Error(`rc-sync: завершено с ${totalErrors} ошибк(ами) upsert — помечаю прогон как провальный`);
  }
}

main().catch((err) => {
  logger.error(err, 'rc-sync: fatal error');
  process.exit(1);
});
