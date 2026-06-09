/**
 * Модуль: enrich (боевой, rekvizitai-метод)
 * Что делает:
 *   Берёт действующие компании БЕЗ обогащения (или enrich_status=pending) и обогащает их:
 *     1. rekvizitai по КОДУ: поиск /imones/1/?company_code=<rc_code> → карточка /imone/<slug>/
 *        С карточки СТРОГИМ экстрактором: сайт (строка Tinklalapis), телефон+мобильный,
 *        кредит-риск (A..E), адрес.  ⚠️ строгий экстрактор — иначе теряем сайты (баг LITIT).
 *     2. Финансы из API реестра (data.gov.lt pelno_ataskaitos) — выручка/прибыль последнего года.
 *     3. Домен-угадка {slug}.lt/.com/.eu/.tech + верификация (rc_code/имя на странице, не редирект на rekvizitai).
 *        has_website = (сайт из rekvizitai) ИЛИ (угаданный домен прошёл верификацию).
 *     4. email с сайта компании (/kontaktai), если сайт есть.
 *   Классификация: D/E кредит-риск → enrich_status=archived_garbage (НЕ удаляем, больше НЕ прогоняем).
 *                  A/B/C/unknown → rekvizitai_done. lead_branch: есть сайт → A_bad_site, нет → B_no_site.
 *
 *   ⚠️ FETCH_ERR (фетч не удался) ≠ «нет сайта» — такие НЕ архивируем, оставляем pending на перепрогон.
 *   ⚠️ Параллелизм жёстко ≤ 6 (поисковый эндпоинт rekvizitai не держит больше → таймауты). Детектор блока.
 *
 * Как запустить:
 *   npm run worker:enrich -- --limit=200                 # 200 компаний, 6 потоков
 *   npm run worker:enrich -- --niche=41 --limit=500
 *   npm run worker:enrich -- --dry-run --limit=20        # без записи в БД
 *
 * Зависит от: src/lib/db.ts (Prisma), src/lib/logger.ts (pino), _runner.ts (CLI).
 * НЕ импортирует src/lib/config — rekvizitai и RC API публичные, секреты не нужны.
 */

import http from 'node:http';
import https from 'node:https';
import type { Logger } from 'pino';
import { Prisma, type CreditRisk } from '@prisma/client';
import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

const log: Logger = logger.child({ module: 'enrich' });

// ─── Константы ────────────────────────────────────────────────────────────────

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const REKV_BASE = 'https://rekvizitai.vz.lt';
const SEARCH = (code: string) =>
  `${REKV_BASE}/imones/1/?scrollTo=searchForm&name=&company_code=${code}` +
  `&search_word=&industry=&search_terms=&location=&catUrlKey=&resetFilter=0&order=1&redirected=1`;
const RC_FIN = (code: string) =>
  `https://get.data.gov.lt/datasets/gov/rc/jar/pelno_ataskaitos/PelnoAtaskaita` +
  `?juridinis_asmuo.ja_kodas=${code}&limit(400)`;

/** Потолок параллелизма. 10 — осознанно (база на 55% обогащена так за ~2 дня; добиваем остаток).
 *  Риск: при долбёжке Cloudflare со временем может забанить и IPv6 (последний чистый IP). */
const CONCURRENCY = 10;
/** Подряд блок-ответов (403/429/503), после которых прерываем прогон (защита от бана). */
const BLOCK_ABORT = 6;
const FETCH_TIMEOUT_MS = 20_000;

const RISK_MAP: Record<string, CreditRisk> = {
  žemiausia: 'A',
  žema: 'B',
  vidutinė: 'C',
  aukšta: 'D',
  aukščiausia: 'E',
};

// TLD для домен-угадки {slug}.<tld>.
const SITE_TLDS = ['lt', 'com', 'eu', 'tech'];

// Транслитерация литовских диакритиков в ASCII (для домен-угадки: Švara → svara, а не vara).
const LT_TRANSLIT: Record<string, string> = {
  ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z',
};
const deLt = (s: string) => s.replace(/[ąčęėįšųūž]/g, (c) => LT_TRANSLIT[c] ?? c);

// ─── HTTP ─────────────────────────────────────────────────────────────────────

type FetchResult = { code: number; body: string };

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const isBlock = (c: number) => c === 403 || c === 429 || c === 503;

/**
 * Низкоуровневый GET на node:https с возможностью форсить IP-семейство.
 * ⚠️ family=6 нужен для rekvizitai: он за Cloudflare, и наш IPv4 им забанен (403) после
 *    долбёжки в 10 потоков; IPv6-адрес хоста чист (200). Контейнеру включён IPv6 (см. compose).
 *    Для прочих фетчей (домен-угадка, email) family=0 — иначе IPv4-only сайты отвалятся.
 * Следует за редиректами (до 4), сохраняя family. status=0 — сетевая ошибка/таймаут.
 */
function rawGet(
  url: string,
  timeoutMs: number,
  family: 0 | 4 | 6,
  redirectsLeft = 4,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (status: number, body: string) => {
      if (settled) return;
      settled = true;
      resolve({ status, body });
    };
    const mod = url.startsWith('http://') ? http : https;
    const req = mod.request(
      url,
      {
        method: 'GET',
        ...(family ? { family } : {}),
        headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'lt' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const loc = res.headers.location;
        if (status >= 300 && status < 400 && loc && redirectsLeft > 0) {
          res.resume(); // сливаем тело редиректа
          rawGet(new URL(loc, url).toString(), timeoutMs, family, redirectsLeft - 1).then((r) =>
            done(r.status, r.body),
          );
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(status, Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => done(status, ''));
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      done(0, '');
    });
    req.on('error', () => done(0, ''));
    req.end();
  });
}

/** Возвращает {code, body}. code=0 — сетевая ошибка/таймаут. Ретраи на пустое/сбойное.
 *  family=6 форсит IPv6 (для rekvizitai — его IPv4 за Cloudflare забанен). */
async function fetchHtml(
  url: string,
  tries = 2,
  timeoutMs = FETCH_TIMEOUT_MS,
  family: 0 | 4 | 6 = 0,
): Promise<FetchResult> {
  let lastCode = 0;
  for (let attempt = 0; attempt < tries; attempt++) {
    const { status, body } = await rawGet(url, timeoutMs, family);
    lastCode = status;
    if (isBlock(status)) return { code: status, body: '' }; // блок — не долбим
    // Non-OK (404/500/502/504…) и сетевые сбои (0) — не валидный ответ: ретраим.
    // иначе пустой результат поиска финализируется как «нет сайта» (FETCH_ERR ≠ нет-сайта).
    if (status === 0 || status >= 400) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (body) return { code: status, body };
    await sleep(1500 * (attempt + 1));
  }
  return { code: lastCode, body: '' };
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    return await r.json();
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

// ─── Экстракторы ────────────────────────────────────────────────────────────────

/** СТРОГИЙ экстрактор сайта: только ссылка из строки таблицы Tinklalapis (иначе ловим чужие ссылки). */
function siteStrict(cardHtml: string): string {
  const m = cardHtml.match(
    /<td class="name">\s*Tinklalapis\s*<\/td>\s*<td class="value">\s*<a href="([^"]+)"/i,
  );
  return m ? m[1].trim() : '';
}

/** Ссылка на карточку из результата поиска по коду. '' = не нашли (реально нет в rekvizitai). */
function cardLink(searchHtml: string): string {
  const m = searchHtml.match(/\/imone\/[a-z0-9_-]+\//i);
  return m ? m[0] : '';
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

interface CardData {
  phone: string;
  mobile: string;
  creditRisk: CreditRisk | null;
  creditLabel: string;
  address: string;
}

const EMPTY_CARD: CardData = { phone: '', mobile: '', creditRisk: null, creditLabel: '', address: '' };

function parseCard(h: string): CardData {
  const d: CardData = { phone: '', mobile: '', creditRisk: null, creditLabel: '', address: '' };

  const nums: string[] = [];
  for (const raw of h.match(/\+?370[\s\d]{6,12}/g) ?? []) {
    let n = raw.replace(/\s+/g, '');
    if (!n.startsWith('+')) n = '+' + n;
    if (n.length >= 9 && n.length <= 13 && !nums.includes(n)) nums.push(n);
  }
  if (nums[0]) d.phone = nums[0];
  if (nums[1]) d.mobile = nums[1];

  const cr = h.match(/prescore-risk[\s\S]*?<span class="\w+">([^<]+)<\/span>/);
  if (cr) {
    const lbl = unescapeHtml(cr[1].trim());
    d.creditLabel = lbl;
    d.creditRisk = RISK_MAP[lbl.toLowerCase()] ?? null;
  }

  const am = h.match(/Adresas:\s*([^\n<]{5,90})/);
  if (am) d.address = unescapeHtml(am[1].trim());

  return d;
}

interface FinData {
  revenue: number | null;
  profit: number | null;
  year: number | null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function financials(code: string): Promise<FinData> {
  const out: FinData = { revenue: null, profit: null, year: null };
  const data = await fetchJson(RC_FIN(code));
  const rows: any[] = data?._data ?? [];
  if (!rows.length) return out;
  const years = [...new Set(rows.map((r) => r.laikotarpis_iki).filter(Boolean))].sort().reverse();
  if (!years.length) return out;
  const y = years[0];
  for (const r of rows) {
    if (r.laikotarpis_iki !== y) continue;
    const ln = String(r.line_name ?? '').toUpperCase();
    if (ln.includes('PARDAVIMO PAJAMOS')) out.revenue = toNum(r.reiksme);
    if (ln.includes('GRYNAS') && (ln.includes('PELN') || ln.includes('NUOSTOL'))) out.profit = toNum(r.reiksme);
  }
  out.year = parseInt(String(y).slice(0, 4), 10) || null;
  return out;
}

const EMAIL_JUNK = ['sentry', 'wixpress', 'example', '.png', '.jpg', '.gif', 'creditinfo', 'godaddy', 'cloudflare', '@2x'];

/** email с сайта компании (главная + /kontaktai). '' если не нашли. */
async function siteEmail(website: string): Promise<string> {
  if (!website) return '';
  let site = website.startsWith('http') ? website : 'http://' + website;
  site = site.replace(/\/+$/, '');
  for (const p of ['', '/kontaktai']) {
    const { body } = await fetchHtml(site + p, 1, 6000);
    if (!body) continue;
    const h = body.replace(/%20/g, '').replace(/&#64;/g, '@');
    for (const e of h.match(/[a-zA-Z0-9][a-zA-Z0-9._+-]{1,63}@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) ?? []) {
      const el = e.toLowerCase();
      if (/^\d+$/.test(el.split('@')[0])) continue;
      if (!EMAIL_JUNK.some((x) => el.includes(x))) return el;
    }
  }
  return '';
}

/**
 * Домен-угадка: {slug}.tld для каждого TLD. Сайт «свой», если на странице есть rc_code или имя,
 * и нет редиректа на rekvizitai. Возвращает первый подтверждённый URL или ''.
 */
async function guessDomain(name: string, rcCode: string): Promise<string> {
  const slug = deLt(name.toLowerCase())
    .replace(/\b(uab|mb|vsi|ab|ka|ko|individuali|imone)\b/g, '') // правовые формы (уже транслит)
    .replace(/[^a-z0-9]+/g, '');
  if (slug.length < 3) return '';
  const nameTokens = name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 4);
  // TLD пробуем ПАРАЛЛЕЛЬНО (разные домены, не rekvizitai → нагрузки на него не добавляет),
  // затем берём первый подтверждённый в порядке приоритета SITE_TLDS (.lt раньше .com…).
  const checks = await Promise.all(
    SITE_TLDS.map(async (tld) => {
      const url = `https://${slug}.${tld}`;
      const { code, body } = await fetchHtml(url, 1, 6000);
      if (code === 0 || !body) return null;
      const low = body.toLowerCase();
      if (low.includes('rekvizitai.vz.lt')) return null;
      const hit = body.includes(rcCode) || nameTokens.some((t) => low.includes(t));
      return hit ? url : null;
    }),
  );
  return checks.find((u): u is string => Boolean(u)) ?? '';
}

// ─── Обогащение одной компании ──────────────────────────────────────────────────

type Outcome = 'enriched' | 'archived' | 'fetch_err' | 'block';

interface EnrichResult {
  outcome: Outcome;
  data?: Prisma.EnrichmentUncheckedCreateInput;
}

type CompanyRow = { id: string; rc_code: string; name: string };

async function enrichOne(company: CompanyRow): Promise<EnrichResult> {
  // 1. Поиск по коду → ссылка на карточку. family=6 — rekvizitai ходим строго по IPv6 (IPv4 забанен).
  const search = await fetchHtml(SEARCH(company.rc_code), 2, FETCH_TIMEOUT_MS, 6);
  if (isBlock(search.code)) return { outcome: 'block' };
  if (!search.body) return { outcome: 'fetch_err' };
  const link = cardLink(search.body);
  if (!link) {
    // Поиск загрузился, карточки нет → реально нет в rekvizitai. Обогащаем тем, что есть (финансы+домен).
    return finalize(company, '', EMPTY_CARD);
  }

  // 2. Карточка. family=6 — тоже по IPv6.
  const card = await fetchHtml(REKV_BASE + link, 2, FETCH_TIMEOUT_MS, 6);
  if (isBlock(card.code)) return { outcome: 'block' };
  if (!card.body) return { outcome: 'fetch_err' };

  const site = siteStrict(card.body);
  return finalize(company, site, parseCard(card.body));
}

async function finalize(company: CompanyRow, rekvSite: string, card: CardData): Promise<EnrichResult> {
  // Финансы из реестра параллельно домен-угадке (угадку делаем только если сайта из rekvizitai нет).
  const [fin, guessed] = await Promise.all([
    financials(company.rc_code),
    rekvSite ? Promise.resolve('') : guessDomain(company.name, company.rc_code),
  ]);

  const website = rekvSite || guessed;
  const hasWebsite = Boolean(website);
  const email = website ? await siteEmail(website) : '';

  const isGarbage = card.creditRisk === 'D' || card.creditRisk === 'E';

  const data: Prisma.EnrichmentUncheckedCreateInput = {
    company_id: company.id,
    enrich_status: isGarbage ? 'archived_garbage' : 'rekvizitai_done',
    website_url: website || null,
    website_status: hasWebsite ? 'verified_own_website' : 'no_own_website',
    has_website: hasWebsite,
    phone: card.phone || null,
    mobile: card.mobile || null,
    email: email || null,
    credit_risk: card.creditRisk ?? (card.creditLabel ? null : 'unknown'),
    credit_label: card.creditLabel || null,
    revenue: fin.revenue != null ? new Prisma.Decimal(fin.revenue) : null,
    profit: fin.profit != null ? new Prisma.Decimal(fin.profit) : null,
    fin_year: fin.year,
    lead_branch: hasWebsite ? 'A_bad_site' : 'B_no_site',
    review_status: isGarbage ? 'rejected' : 'needs_review',
    enriched_at: new Date(),
  };

  return { outcome: isGarbage ? 'archived' : 'enriched', data };
}

// ─── Прогон (промис-пул ≤ CONCURRENCY) ───────────────────────────────────────────

interface Stats {
  enriched: number;
  archived: number;
  fetchErr: number;
  blocks: number;
  withSite: number;
}

async function run(): Promise<void> {
  const args = parseArgs();
  const limit = args.limit ?? 200;
  const concurrency = Math.min(args.batch || CONCURRENCY, CONCURRENCY);

  log.info({ niche: args.niche, limit, concurrency, dryRun: args.dryRun }, 'enrich start (rekvizitai)');

  // Активные компании без обогащения или со статусом pending. archived_garbage/*_done пропускаем.
  const companies = await db.company.findMany({
    where: {
      status: 'active',
      ...(args.niche ? { evrk2_code: args.niche } : {}),
      OR: [{ enrichment: { is: null } }, { enrichment: { enrich_status: 'pending' } }],
    },
    take: limit,
    select: { id: true, rc_code: true, name: true },
  });

  log.info({ picked: companies.length }, 'companies selected');
  if (!companies.length) {
    log.info('nothing to enrich — done');
    await db.$disconnect();
    return;
  }

  const stats: Stats = { enriched: 0, archived: 0, fetchErr: 0, blocks: 0, withSite: 0 };
  let consecutiveBlocks = 0;
  let aborted = false;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < companies.length && !aborted) {
      const company = companies[idx++];
      try {
        const res = await enrichOne(company);
        if (res.outcome === 'block') {
          stats.blocks++;
          if (++consecutiveBlocks >= BLOCK_ABORT) {
            aborted = true;
            log.error({ at: idx, blocks: stats.blocks }, 'ABORT: подряд блок-ответов — возможен бан rekvizitai');
          }
          continue;
        }
        consecutiveBlocks = 0;
        if (res.outcome === 'fetch_err' || !res.data) {
          stats.fetchErr++;
          continue; // оставляем без enrichment → перепрогон позже
        }
        if (res.data.has_website) stats.withSite++;
        if (res.outcome === 'archived') stats.archived++;
        else stats.enriched++;
        if (!args.dryRun) {
          const { company_id, ...rest } = res.data;
          await db.enrichment.upsert({ where: { company_id }, create: res.data, update: rest });
        }
      } catch (err) {
        stats.fetchErr++;
        log.warn({ rc_code: company.rc_code, err: String(err).slice(0, 160) }, 'enrich error');
      }
      const done = stats.enriched + stats.archived + stats.fetchErr;
      if (done > 0 && done % 100 === 0) log.info({ ...stats, processed: idx }, 'progress');
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  log.info(
    {
      ...stats,
      sitePct: stats.enriched ? Math.round((stats.withSite * 100) / stats.enriched) : 0,
      aborted,
      dryRun: args.dryRun,
    },
    'enrich done',
  );

  await db.$disconnect();
}

run().catch((err) => {
  log.error(err, 'enrich fatal');
  process.exit(1);
});
