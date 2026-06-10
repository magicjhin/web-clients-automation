/**
 * dashboard-queries.ts — all Prisma read queries for the dashboard.
 *
 * All queries are server-side only. No DB access leaks to the client.
 * A "lead" = enrichment with enrich_status='rekvizitai_done'
 *            AND credit_risk IN (A, B, C)
 *            AND lead_branch IN (A_bad_site, B_no_site).
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentSubscriberId } from '@/lib/subscriber';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalCompanies: number;
  enrichedCount: number;
  enrichedPercent: number;
  leadsTotal: number;
  leadsABadSite: number;
  leadsBNoSite: number;
  withWebsite: number;
  withoutWebsite: number;
  creditA: number;
  creditB: number;
  creditC: number;
}

export interface LeadFilters {
  branch?: 'A_bad_site' | 'B_no_site';
  credit_risk?: 'A' | 'B' | 'C';
  has_website?: 'yes' | 'no';
  has_phone?: 'yes' | 'no';
  niche?: string; // evrk2_code starts-with
  minRevenue?: number;
  q?: string; // name contains (case-insensitive)
  page?: number;
  pageSize?: number;
}

export interface LeadRow {
  id: string;
  name: string;
  city: string | null;
  evrk2_code: string;
  evrk2_name: string;
  lead_branch: 'A_bad_site' | 'B_no_site';
  credit_risk: 'A' | 'B' | 'C';
  revenue: string | null; // Decimal serialised as string
  phone: string | null;
  mobile: string | null;
  website_url: string | null;
  has_website: boolean;
  email: string | null;
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
  review_status: string;
  enrichment_id: string;
}

export interface LeadsResult {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Stats query
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalCompanies, enrichedCount, leadGroups] = await Promise.all([
    db.company.count(),

    db.enrichment.count({
      where: { enrich_status: 'rekvizitai_done' },
    }),

    db.enrichment.groupBy({
      by: ['lead_branch', 'credit_risk', 'has_website'],
      where: {
        enrich_status: 'rekvizitai_done',
        lead_branch: { in: ['A_bad_site', 'B_no_site'] },
        credit_risk: { in: ['A', 'B', 'C'] },
      },
      _count: { id: true },
    }),
  ]);

  let leadsTotal = 0;
  let leadsABadSite = 0;
  let leadsBNoSite = 0;
  let withWebsite = 0;
  let withoutWebsite = 0;
  let creditA = 0;
  let creditB = 0;
  let creditC = 0;

  for (const g of leadGroups) {
    const n = g._count.id;
    leadsTotal += n;
    if (g.lead_branch === 'A_bad_site') leadsABadSite += n;
    if (g.lead_branch === 'B_no_site') leadsBNoSite += n;
    if (g.has_website) withWebsite += n;
    else withoutWebsite += n;
    if (g.credit_risk === 'A') creditA += n;
    if (g.credit_risk === 'B') creditB += n;
    if (g.credit_risk === 'C') creditC += n;
  }

  const enrichedPercent =
    totalCompanies > 0 ? Math.round((enrichedCount / totalCompanies) * 100) : 0;

  return {
    totalCompanies,
    enrichedCount,
    enrichedPercent,
    leadsTotal,
    leadsABadSite,
    leadsBNoSite,
    withWebsite,
    withoutWebsite,
    creditA,
    creditB,
    creditC,
  };
}

// ---------------------------------------------------------------------------
// Leads list query (filtered + paginated)
// ---------------------------------------------------------------------------

export async function getLeads(filters: LeadFilters): Promise<LeadsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  // Build all conditions into an AND array — avoids property conflicts.
  const conditions: Prisma.EnrichmentWhereInput[] = [
    { enrich_status: 'rekvizitai_done' },
    {
      lead_branch: filters.branch
        ? filters.branch
        : { in: ['A_bad_site', 'B_no_site'] },
    },
    {
      credit_risk: filters.credit_risk
        ? filters.credit_risk
        : { in: ['A', 'B', 'C'] },
    },
  ];

  if (filters.has_website === 'yes') conditions.push({ has_website: true });
  if (filters.has_website === 'no') conditions.push({ has_website: false });

  if (filters.has_phone === 'yes') {
    conditions.push({
      OR: [{ phone: { not: null } }, { mobile: { not: null } }],
    });
  }
  if (filters.has_phone === 'no') {
    conditions.push({ phone: null, mobile: null });
  }

  if (filters.minRevenue != null) {
    conditions.push({ revenue: { gte: new Prisma.Decimal(filters.minRevenue) } });
  }

  // Build company where clause
  const companyWhere: Prisma.CompanyWhereInput = {};
  if (filters.niche) {
    companyWhere.evrk2_code = { startsWith: filters.niche };
  }
  if (filters.q) {
    companyWhere.name = { contains: filters.q, mode: 'insensitive' };
  }

  if (Object.keys(companyWhere).length > 0) {
    conditions.push({ company: companyWhere });
  }

  const where: Prisma.EnrichmentWhereInput = { AND: conditions };

  const [rawLeads, total] = await Promise.all([
    db.enrichment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ credit_risk: 'asc' }, { revenue: 'desc' }],
      select: {
        id: true,
        lead_branch: true,
        credit_risk: true,
        revenue: true,
        phone: true,
        mobile: true,
        website_url: true,
        has_website: true,
        email: true,
        pagespeed_mobile: true,
        pagespeed_desktop: true,
        review_status: true,
        company: {
          select: {
            id: true,
            name: true,
            city: true,
            evrk2_code: true,
            evrk2_name: true,
          },
        },
      },
    }),
    db.enrichment.count({ where }),
  ]);

  const leads: LeadRow[] = rawLeads.map((e) => ({
    id: e.company.id,
    name: e.company.name,
    city: e.company.city,
    evrk2_code: e.company.evrk2_code,
    evrk2_name: e.company.evrk2_name,
    lead_branch: e.lead_branch as 'A_bad_site' | 'B_no_site',
    credit_risk: e.credit_risk as 'A' | 'B' | 'C',
    revenue: e.revenue != null ? e.revenue.toString() : null,
    phone: e.phone,
    mobile: e.mobile,
    website_url: e.website_url,
    has_website: e.has_website,
    email: e.email,
    pagespeed_mobile: e.pagespeed_mobile,
    pagespeed_desktop: e.pagespeed_desktop,
    review_status: e.review_status,
    enrichment_id: e.id,
  }));

  return {
    leads,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Funnel stats
// ---------------------------------------------------------------------------

export type FunnelPeriod = 'week' | 'month' | 'quarter' | 'all';

export interface FunnelStats {
  notProcessed: number;
  inWork: number;
  responded: number;
  ignored: number;
  refused: number;
  won: number;
  totalQualifying: number;
}

/**
 * Считает воронку продаж для подписчика.
 *
 * totalQualifying / notProcessed не зависят от period — это общий пул квалифицирующих лидов.
 * Остальные счётчики (inWork/responded/ignored/refused/won) фильтруют LeadDelivery.delivered_at
 * по period: week=7д, month=30д, quarter=90д, all=без фильтра.
 *
 * Квалифицирующий лид:
 *   enrich_status='rekvizitai_done' AND credit_risk IN (A,B,C)
 *   AND lead_branch IN (A_bad_site, B_no_site)
 */
export async function getFunnelStats(
  subscriberId: string,
  period: FunnelPeriod,
): Promise<FunnelStats> {
  // Дата отсечки для фильтра period
  const cutoff: Date | null = (() => {
    const now = new Date();
    if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (period === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (period === 'quarter') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return null; // 'all'
  })();

  // Период-фильтр для LeadDelivery
  const deliveredAtFilter = cutoff ? { delivered_at: { gte: cutoff } } : {};

  // Критерий квалифицирующего лида (тот же, что в getLeads).
  const qualifying: Prisma.EnrichmentWhereInput = {
    enrich_status: 'rekvizitai_done',
    lead_branch: { in: ['A_bad_site', 'B_no_site'] },
    credit_risk: { in: ['A', 'B', 'C'] },
  };

  // LeadDelivery → company → enrichment квалифицирующий (relation-фильтр, БЕЗ выгрузки
  // ~97k company_id в IN-список — иначе тяжёлый запрос на каждый показ Сводки).
  const qualifyingDelivery: Prisma.LeadDeliveryWhereInput = {
    subscriber_id: subscriberId,
    company: { enrichment: { is: qualifying } },
  };

  const [totalQualifying, processedAll, grouped] = await Promise.all([
    db.enrichment.count({ where: qualifying }),
    // Все взятые в работу (любой период) — для notProcessed. Одна запись на компанию.
    db.leadDelivery.count({ where: qualifyingDelivery }),
    // Счётчики по исходу за выбранный период.
    db.leadDelivery.groupBy({
      by: ['lead_outcome'],
      where: { ...qualifyingDelivery, ...deliveredAtFilter },
      _count: { _all: true },
    }),
  ]);

  let inWork = 0;
  let responded = 0;
  let ignored = 0;
  let refused = 0;
  let won = 0;
  for (const g of grouped) {
    const n = g._count._all;
    switch (g.lead_outcome) {
      case 'sent':
        inWork += n;
        break;
      case 'in_progress':
        responded += n;
        break;
      case 'no_response':
        ignored += n;
        break;
      case 'lost':
        refused += n;
        break;
      case 'won':
        won += n;
        break;
    }
  }

  const notProcessed = Math.max(0, totalQualifying - processedAll);

  return { totalQualifying, notProcessed, inWork, responded, ignored, refused, won };
}

// ---------------------------------------------------------------------------
// Call reminders
// ---------------------------------------------------------------------------

export interface CallReminder {
  companyId: string;
  name: string;
  city: string | null;
  phone: string | null;
  mobile: string | null;
  next_call_at: string; // ISO-string
  outcome: string;
  note: string | null;
  overdue: boolean;
}

/**
 * Возвращает запланированные звонки для подписчика.
 * Только записи LeadDelivery с next_call_at != null, сортировка asc, лимит 50.
 * overdue = true, если next_call_at уже прошло.
 */
export async function getCallReminders(subscriberId: string): Promise<CallReminder[]> {
  const now = new Date();

  const rows = await db.leadDelivery.findMany({
    where: {
      subscriber_id: subscriberId,
      next_call_at: { not: null },
    },
    orderBy: { next_call_at: 'asc' },
    take: 50,
    select: {
      company_id: true,
      next_call_at: true,
      lead_outcome: true,
      note: true,
      company: {
        select: { name: true, city: true },
      },
      // Берём телефон из enrichment через company → enrichment
    },
  });

  // Подгружаем телефоны из enrichment
  const companyIds = rows.map((r) => r.company_id);
  const enrichments = await db.enrichment.findMany({
    where: { company_id: { in: companyIds } },
    select: { company_id: true, phone: true, mobile: true },
  });
  const phoneMap = new Map(enrichments.map((e) => [e.company_id, { phone: e.phone, mobile: e.mobile }]));

  return rows.map((r) => {
    const phones = phoneMap.get(r.company_id);
    const next = r.next_call_at!; // guaranteed by where filter
    return {
      companyId: r.company_id,
      name: r.company.name,
      city: r.company.city,
      phone: phones?.phone ?? null,
      mobile: phones?.mobile ?? null,
      next_call_at: next.toISOString(),
      outcome: r.lead_outcome,
      note: r.note,
      overdue: next < now,
    };
  });
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export interface ReviewItem {
  companyId: string;
  name: string;
  city: string | null;
  lead_branch: string | null;
  credit_risk: string | null;
  reason: 'needs_review' | 'audit_ready';
  audit_status: string;
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
}

/**
 * Возвращает очередь на ревью = аудиты, готовые к проверке человеком (audit_status='done').
 *
 * ВАЖНО: НЕ используем review_status='needs_review' — воркер enrich ставит этот статус
 * ВСЕМ не-мусорным записям по умолчанию (см. workers/enrich), поэтому он залил бы очередь
 * всей базой (~97k). Очередь = только то, по чему оператор запросил аудит и он посчитан.
 * Письма (фаза 2) добавятся сюда тем же принципом — content.status='draft'/'confirmed'.
 * Лимит 100 записей.
 */
export async function getReviewQueue(subscriberId: string): Promise<ReviewItem[]> {
  // subscriberId — для совместимости с мультитенантным контрактом (фаза 2). На фазе 1
  // один subscriber, аудит запрашивается на его лидах, доп. фильтр не нужен.
  void subscriberId;

  const rows = await db.enrichment.findMany({
    where: { audit_status: 'done' },
    orderBy: [{ audit_done_at: 'desc' }],
    take: 100,
    select: {
      company_id: true,
      lead_branch: true,
      credit_risk: true,
      review_status: true,
      audit_status: true,
      pagespeed_mobile: true,
      pagespeed_desktop: true,
      company: {
        select: { name: true, city: true },
      },
    },
  });

  return rows.map((r) => ({
    companyId: r.company_id,
    name: r.company.name,
    city: r.company.city,
    lead_branch: r.lead_branch,
    credit_risk: r.credit_risk,
    reason: r.audit_status === 'done' ? 'audit_ready' : 'needs_review',
    audit_status: r.audit_status,
    pagespeed_mobile: r.pagespeed_mobile,
    pagespeed_desktop: r.pagespeed_desktop,
  }));
}

// ---------------------------------------------------------------------------
// Single lead / company detail
// ---------------------------------------------------------------------------

export interface CompanyDetail {
  id: string;
  rc_code: string;
  name: string;
  evrk2_code: string;
  evrk2_name: string;
  status: string;
  sector: string | null;
  legal_form: string | null;
  address: string | null;
  city: string | null;
  reg_date: Date | null;
  financials: Prisma.JsonValue | null;
  rc_synced_at: Date | null;
  enrichment: {
    id: string;
    enrich_status: string;
    website_status: string;
    website_url: string | null;
    has_website: boolean;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    credit_risk: string | null;
    credit_label: string | null;
    revenue: string | null;
    profit: string | null;
    fin_year: number | null;
    google_rating: string | null;
    pagespeed_mobile: number | null;
    pagespeed_desktop: number | null;
    audit_issues: Prisma.JsonValue | null;
    audit_status: string;
    lead_branch: string | null;
    review_status: string;
    enriched_at: Date | null;
    places_match_confidence: string | null;
    places_match_score: number | null;
  } | null;
  /** Состояние работы с лидом (LeadDelivery текущего subscriber). */
  work: {
    outcome: string | null;
    next_call_at: string | null; // ISO
    note: string | null;
  };
}

export async function getCompanyDetail(id: string): Promise<CompanyDetail | null> {
  const company = await db.company.findUnique({
    where: { id },
    include: {
      enrichment: {
        select: {
          id: true,
          enrich_status: true,
          website_status: true,
          website_url: true,
          has_website: true,
          phone: true,
          mobile: true,
          email: true,
          credit_risk: true,
          credit_label: true,
          revenue: true,
          profit: true,
          fin_year: true,
          google_rating: true,
          pagespeed_mobile: true,
          pagespeed_desktop: true,
          audit_issues: true,
          audit_status: true,
          lead_branch: true,
          review_status: true,
          enriched_at: true,
          places_match_confidence: true,
          places_match_score: true,
        },
      },
    },
  });

  if (!company) return null;

  // Состояние работы с лидом (LeadDelivery текущего subscriber).
  const subscriberId = await getCurrentSubscriberId();
  const delivery = await db.leadDelivery.findFirst({
    where: { subscriber_id: subscriberId, company_id: id },
    select: { lead_outcome: true, next_call_at: true, note: true },
  });

  return {
    ...company,
    enrichment: company.enrichment
      ? {
          ...company.enrichment,
          revenue: company.enrichment.revenue?.toString() ?? null,
          profit: company.enrichment.profit?.toString() ?? null,
          google_rating: company.enrichment.google_rating?.toString() ?? null,
        }
      : null,
    work: {
      outcome: delivery?.lead_outcome ?? null,
      next_call_at: delivery?.next_call_at?.toISOString() ?? null,
      note: delivery?.note ?? null,
    },
  };
}
