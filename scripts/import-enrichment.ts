/**
 * scripts/import-enrichment.ts — разовый импорт ночного прогона 12k в таблицу enrichment.
 *
 * Сводит ТРИ слоя сайтов (union, дедуп по rc_code) + кредит-риск + финансы из results_full:
 *   1. results_full.tsv — code,status,website,phone,mobile,credit,credit_label,address,revenue,profit,fin_year,email
 *      (website тут БАГНУТЫЙ — недосчёт; берём как один из источников union)
 *   2. resite.tsv       — code,name,site         (исправленный строгий экстрактор Tinklalapis)
 *   3. site_verify.tsv  — code,name,verified_site (домен-угадка {имя}.lt/.com/.eu)
 *
 * has_website = есть сайт хотя бы в одном слое. website_url = первый непустой (rekvizitai > resite > угадка).
 * D/E кредит-риск → enrich_status=archived_garbage, review_status=rejected (НЕ удаляем, не прогоняем повторно).
 * A/B/C/unknown → rekvizitai_done.
 *
 * Компания ищется по rc_code; нет в companies → пропуск (логируем счётчик).
 *
 * Запуск (на VPS, где БД и файлы):
 *   npx tsx scripts/import-enrichment.ts \
 *     --full=/tmp/results_full.tsv --resite=/tmp/resite.tsv --verify=/tmp/site_verify.tsv
 *   npx tsx scripts/import-enrichment.ts --dry-run     # дефолтные пути /tmp/*.tsv, без записи
 */

import { readFileSync } from 'node:fs';
import { Prisma, type CreditRisk } from '@prisma/client';
import { db } from '../src/lib/db';
import { logger } from '../src/lib/logger';

const log = logger.child({ module: 'import-enrichment' });

function arg(name: string, def: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
}
const DRY = process.argv.includes('--dry-run');
const FULL = arg('full', '/tmp/results_full.tsv');
const RESITE = arg('resite', '/tmp/resite.tsv');
const VERIFY = arg('verify', '/tmp/site_verify.tsv');

/** Читает TSV → массив объектов по заголовку первой строки. */
function readTsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, 'utf-8').split('\n').filter((l) => l.length > 0);
  const header = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const cols = l.split('\t');
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (cols[i] ?? '').trim()));
    return o;
  });
}

/** Колонка сайта по коду из вспомогательного файла (resite/verify). */
function siteByCode(path: string, col: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of readTsv(path)) {
    const code = row.code;
    const v = row[col];
    if (code && v && v !== 'FETCH_ERR') m.set(code, v);
  }
  return m;
}

const VALID_RISK = new Set(['A', 'B', 'C', 'D', 'E']);
function toNum(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  log.info({ FULL, RESITE, VERIFY, dryRun: DRY }, 'import start');

  const resite = siteByCode(RESITE, 'site');
  const verify = siteByCode(VERIFY, 'verified_site');
  const full = readTsv(FULL).filter((r) => r.status === 'ok');
  log.info({ full: full.length, resite: resite.size, verify: verify.size }, 'tsv loaded');

  const stats = { upserted: 0, archived: 0, withSite: 0, noCompany: 0, skippedStatus: 0 };
  let batch: Promise<unknown>[] = [];

  for (const r of full) {
    const code = r.code;
    if (!code) continue;

    const company = await db.company.findUnique({ where: { rc_code: code }, select: { id: true } });
    if (!company) {
      stats.noCompany++;
      continue;
    }

    const website = r.website || resite.get(code) || verify.get(code) || '';
    const hasWebsite = Boolean(website);
    const risk = (r.credit || '').toUpperCase();
    const creditRisk: CreditRisk | null = VALID_RISK.has(risk) ? (risk as CreditRisk) : r.credit_label ? null : 'unknown';
    const isGarbage = creditRisk === 'D' || creditRisk === 'E';

    const rev = toNum(r.revenue);
    const prof = toNum(r.profit);
    const finYear = r.fin_year ? parseInt(r.fin_year.slice(0, 4), 10) || null : null;

    const data: Prisma.EnrichmentUncheckedCreateInput = {
      company_id: company.id,
      enrich_status: isGarbage ? 'archived_garbage' : 'rekvizitai_done',
      website_url: website || null,
      website_status: hasWebsite ? 'verified_own_website' : 'no_own_website',
      has_website: hasWebsite,
      phone: r.phone || null,
      mobile: r.mobile || null,
      email: r.email || null,
      credit_risk: creditRisk,
      credit_label: r.credit_label || null,
      revenue: rev != null ? new Prisma.Decimal(rev) : null,
      profit: prof != null ? new Prisma.Decimal(prof) : null,
      fin_year: finYear,
      lead_branch: hasWebsite ? 'A_bad_site' : 'B_no_site',
      review_status: isGarbage ? 'rejected' : 'needs_review',
      enriched_at: new Date(),
    };

    if (hasWebsite) stats.withSite++;
    if (isGarbage) stats.archived++;
    stats.upserted++;

    if (!DRY) {
      const { company_id, ...rest } = data;
      batch.push(db.enrichment.upsert({ where: { company_id }, create: data, update: rest }));
      if (batch.length >= 100) {
        await Promise.all(batch);
        batch = [];
      }
    }
    if (stats.upserted % 1000 === 0) log.info({ ...stats }, 'progress');
  }
  if (batch.length) await Promise.all(batch);

  log.info({ ...stats }, 'import done');
  await db.$disconnect();
}

main().catch((err) => {
  log.error(err, 'import fatal');
  process.exit(1);
});
