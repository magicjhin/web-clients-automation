/**
 * Модуль: audit-gen
 * Что делает:
 *   Дренажирует очередь аудита: выбирает Enrichment с audit_status='queued', has_website=true,
 *   website_url != null, запрашивает Google PageSpeed Insights API v5 (mobile + desktop),
 *   формирует шаблонный массив audit_issues из метрик Lighthouse, сохраняет результат.
 *   ВАЖНО: воркер НЕ инициирует аудит автоматически — он обрабатывает ТОЛЬКО то,
 *   что оператор поставил в очередь кнопкой «Запустить аудит» (audit_status='queued').
 *
 * Как запустить:
 *   npx tsx workers/audit-gen/index.ts                  # дефолт: --limit=20 --batch=5
 *   npm run worker:audit-gen -- --limit=50
 *   npm run worker:audit-gen -- --dry-run --limit=5
 *
 * Зависит от: src/lib/db.ts (Prisma), src/lib/logger.ts (pino), src/lib/config.ts (PAGESPEED_API_KEY),
 *              workers/_runner.ts (parseArgs).
 */

import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';
import { config } from '../../src/lib/config';
import { parseArgs } from '../_runner';
import type { Prisma } from '@prisma/client';

const log = logger.child({ module: 'audit-gen' });

// ─── Константы ────────────────────────────────────────────────────────────────

const PAGESPEED_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1; // ретрай 1 раз при сбое (итого 2 попытки)

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface AuditIssue {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  detail: string;
}

interface LighthouseAuditItem {
  displayValue?: string;
  numericValue?: number;
  score?: number | null;
}

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number | null };
    };
    audits?: {
      'first-contentful-paint'?: LighthouseAuditItem;
      'largest-contentful-paint'?: LighthouseAuditItem;
      'total-blocking-time'?: LighthouseAuditItem;
      'cumulative-layout-shift'?: LighthouseAuditItem;
      'speed-index'?: LighthouseAuditItem;
    };
  };
  error?: { code?: number; message?: string };
}

// ─── PageSpeed API ─────────────────────────────────────────────────────────────

async function fetchPageSpeed(
  url: string,
  strategy: 'mobile' | 'desktop',
): Promise<PageSpeedResponse | null> {
  const apiUrl =
    `${PAGESPEED_BASE}?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${config.PAGESPEED_API_KEY}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(apiUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        log.warn({ strategy, status: res.status, attempt, body: body.slice(0, 200) }, 'PageSpeed non-OK');
        if (attempt < MAX_RETRIES) {
          await sleep(3000);
          continue;
        }
        return null;
      }
      const data = (await res.json()) as PageSpeedResponse;
      if (data.error) {
        log.warn({ strategy, error: data.error, attempt }, 'PageSpeed API error field');
        if (attempt < MAX_RETRIES) {
          await sleep(3000);
          continue;
        }
        return null;
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      log.warn({ strategy, err: String(err).slice(0, 160), attempt }, 'PageSpeed fetch error');
      if (attempt < MAX_RETRIES) {
        await sleep(3000);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── Генерация шаблонного аудита ──────────────────────────────────────────────

/**
 * Формирует массив audit_issues из результата PageSpeed Insights.
 * Шаблонный аудит — без LLM. Все формулировки на русском, понятные продавцу.
 */
function buildAuditIssues(
  mobileScore: number | null,
  desktopScore: number | null,
  mobileData: PageSpeedResponse | null,
  desktopData: PageSpeedResponse | null,
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // 1. Оценка скорости мобильной версии
  if (mobileScore !== null) {
    if (mobileScore < 50) {
      issues.push({
        type: 'Низкая скорость загрузки на мобильных',
        severity: 'critical',
        detail: `PageSpeed Mobile = ${mobileScore}/100 — сайт грузится очень медленно. Большинство посетителей уходят, не дождавшись загрузки.`,
      });
    } else if (mobileScore < 90) {
      issues.push({
        type: 'Средняя скорость загрузки на мобильных',
        severity: 'major',
        detail: `PageSpeed Mobile = ${mobileScore}/100 — есть проблемы с производительностью. Требуется оптимизация.`,
      });
    }
  }

  // 2. Оценка скорости десктопной версии
  if (desktopScore !== null && desktopScore < 70) {
    issues.push({
      type: desktopScore < 50 ? 'Низкая скорость загрузки на десктопе' : 'Средняя скорость загрузки на десктопе',
      severity: desktopScore < 50 ? 'critical' : 'major',
      detail: `PageSpeed Desktop = ${desktopScore}/100 — производительность сайта на компьютерах неудовлетворительна.`,
    });
  }

  // 3. LCP (Largest Contentful Paint) — мобильный приоритетнее
  const lcpAudit =
    mobileData?.lighthouseResult?.audits?.['largest-contentful-paint'] ??
    desktopData?.lighthouseResult?.audits?.['largest-contentful-paint'];
  if (lcpAudit?.numericValue != null) {
    const lcpSec = lcpAudit.numericValue / 1000;
    if (lcpSec > 4) {
      issues.push({
        type: 'Долгая загрузка главного контента (LCP)',
        severity: 'critical',
        detail: `Largest Contentful Paint = ${lcpSec.toFixed(1)}с (норма до 2,5с). Пользователь видит пустую страницу слишком долго — высокий показатель отказов.`,
      });
    } else if (lcpSec > 2.5) {
      issues.push({
        type: 'Замедленная загрузка главного контента (LCP)',
        severity: 'major',
        detail: `Largest Contentful Paint = ${lcpSec.toFixed(1)}с (норма до 2,5с). Требуется оптимизация изображений и сервера.`,
      });
    }
  }

  // 4. TBT (Total Blocking Time) — интерактивность
  const tbtAudit =
    mobileData?.lighthouseResult?.audits?.['total-blocking-time'] ??
    desktopData?.lighthouseResult?.audits?.['total-blocking-time'];
  if (tbtAudit?.numericValue != null) {
    const tbtMs = tbtAudit.numericValue;
    if (tbtMs > 600) {
      issues.push({
        type: 'Сайт долго не реагирует на действия пользователя (TBT)',
        severity: 'critical',
        detail: `Total Blocking Time = ${Math.round(tbtMs)}мс (норма до 200мс). Скрипты блокируют браузер — сайт «зависает» при нажатии кнопок.`,
      });
    } else if (tbtMs > 200) {
      issues.push({
        type: 'Задержки интерактивности сайта (TBT)',
        severity: 'major',
        detail: `Total Blocking Time = ${Math.round(tbtMs)}мс (норма до 200мс). Требуется оптимизация JavaScript.`,
      });
    }
  }

  // 5. FCP (First Contentful Paint)
  const fcpAudit =
    mobileData?.lighthouseResult?.audits?.['first-contentful-paint'] ??
    desktopData?.lighthouseResult?.audits?.['first-contentful-paint'];
  if (fcpAudit?.numericValue != null) {
    const fcpSec = fcpAudit.numericValue / 1000;
    if (fcpSec > 3) {
      issues.push({
        type: 'Медленное появление первого контента (FCP)',
        severity: 'major',
        detail: `First Contentful Paint = ${fcpSec.toFixed(1)}с (норма до 1,8с). Первый элемент страницы появляется слишком поздно.`,
      });
    }
  }

  return issues;
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function extractScore(data: PageSpeedResponse | null): number | null {
  const raw = data?.lighthouseResult?.categories?.performance?.score;
  if (raw == null) return null;
  return Math.round(raw * 100);
}

// ─── Обработка одной записи ───────────────────────────────────────────────────

async function processOne(
  enrichmentId: string,
  companyId: string,
  websiteUrl: string,
  dryRun: boolean,
): Promise<'done' | 'failed'> {
  // Атомарный переход queued → running
  if (!dryRun) {
    await db.enrichment.update({
      where: { id: enrichmentId },
      data: { audit_status: 'running' },
    });
  }

  log.info({ enrichmentId, companyId, websiteUrl }, 'fetching PageSpeed (mobile + desktop)');

  // Запросы мобильный и десктоп параллельно
  const [mobileData, desktopData] = await Promise.all([
    fetchPageSpeed(websiteUrl, 'mobile'),
    fetchPageSpeed(websiteUrl, 'desktop'),
  ]);

  const mobileScore = extractScore(mobileData);
  const desktopScore = extractScore(desktopData);

  if (mobileScore === null && desktopScore === null) {
    log.warn({ enrichmentId, websiteUrl }, 'PageSpeed: оба запроса вернули null — failed');
    if (!dryRun) {
      await db.enrichment.update({
        where: { id: enrichmentId },
        data: {
          audit_status: 'failed',
          audit_done_at: new Date(),
        },
      });
    }
    return 'failed';
  }

  const auditIssues = buildAuditIssues(mobileScore, desktopScore, mobileData, desktopData);

  log.info(
    { enrichmentId, mobileScore, desktopScore, issuesCount: auditIssues.length },
    'audit computed',
  );

  if (!dryRun) {
    await db.enrichment.update({
      where: { id: enrichmentId },
      data: {
        pagespeed_mobile: mobileScore,
        pagespeed_desktop: desktopScore,
        audit_issues: auditIssues as unknown as Prisma.InputJsonValue,
        audit_status: 'done',
        audit_done_at: new Date(),
      },
    });
  } else {
    log.info(
      { enrichmentId, mobileScore, desktopScore, auditIssues },
      '[dry-run] audit result (not saved)',
    );
  }

  return 'done';
}

// ─── Основной прогон ──────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const args = parseArgs();
  const limit = args.limit ?? 20;
  const batchSize = args.batch ?? 5;

  log.info({ limit, batch: batchSize, dryRun: args.dryRun }, 'audit-gen start');

  // Выбираем записи с audit_status='queued', has_website=true, website_url != null
  const items = await db.enrichment.findMany({
    where: {
      audit_status: 'queued',
      has_website: true,
      website_url: { not: null },
    },
    orderBy: { audit_requested_at: 'asc' },
    take: limit,
    select: {
      id: true,
      company_id: true,
      website_url: true,
    },
  });

  log.info({ queued: items.length }, 'items picked from queue');

  if (!items.length) {
    log.info('queue empty — nothing to do');
    await db.$disconnect();
    return;
  }

  let done = 0;
  let failed = 0;

  // Обрабатываем пачками (batchSize) для управления параллелизмом
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        // website_url guaranteed non-null by the query filter above
        const url = item.website_url!;
        try {
          const result = await processOne(item.id, item.company_id, url, args.dryRun);
          if (result === 'done') done++;
          else failed++;
        } catch (err) {
          failed++;
          log.error(
            { enrichmentId: item.id, companyId: item.company_id, err: String(err).slice(0, 200) },
            'processOne threw unexpectedly',
          );
          // При неожиданном исключении переводим в failed
          if (!args.dryRun) {
            await db.enrichment
              .update({
                where: { id: item.id },
                data: { audit_status: 'failed', audit_done_at: new Date() },
              })
              .catch((e) => log.warn(e, 'failed to mark as failed'));
          }
        }
      }),
    );

    log.info({ processed: Math.min(i + batchSize, items.length), total: items.length, done, failed }, 'batch done');
  }

  log.info({ done, failed, dryRun: args.dryRun }, 'audit-gen finished');
  await db.$disconnect();
}

run().catch((err) => {
  log.error(err, 'audit-gen fatal error');
  process.exit(1);
});
