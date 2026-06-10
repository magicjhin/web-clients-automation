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
  q?: string; // name contains (case-insensitive)
  review_status?: 'needs_review' | 'auto_approved' | 'manually_approved' | 'rejected';
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

    // «Обогащено» = ВСЕ компании, по которым отработал enrich (и лиды, и отсев D/E).
    // rekvizitai_done + archived_garbage. Раньше считались только rekvizitai_done —
    // показывало ~77%, хотя база обогащена на 100%.
    db.enrichment.count(),

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

  if (filters.review_status) {
    conditions.push({ review_status: filters.review_status });
  }

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

  // ВНИМАНИЕ: финансы (revenue/profit) — атрибут карточки, НЕ фильтр выдачи
  // (CLAUDE.md). Поэтому фильтра по выручке здесь нет — только показ/сортировка.

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
    lead_branch: string | null;
    review_status: string;
    enriched_at: Date | null;
    places_match_confidence: string | null;
    places_match_score: number | null;
  } | null;
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
  };
}

// ---------------------------------------------------------------------------
// Очередь review (needs_review)
// ---------------------------------------------------------------------------
//
// ФАЗА 1 (осознанно): агрегаты ниже считаются по всей базе БЕЗ subscriber_id —
// активен один подписчик (Webvibe/админ видит всю базу), lead_delivery ещё пуст
// (lead-select #14 не запускался), фильтрация по нему сейчас дала бы 0 лидов.
// Тот же паттерн в getDashboardStats/getLeads. При активации мультитенанта (#12)
// все эти запросы переводятся на контекст подписчика через lead_delivery.

/** Сколько лидов ждут проверки человеком (GDPR-предохранитель Tier 3). */
export async function getQueueCount(): Promise<number> {
  return db.enrichment.count({
    where: {
      enrich_status: 'rekvizitai_done',
      lead_branch: { in: ['A_bad_site', 'B_no_site'] },
      credit_risk: { in: ['A', 'B', 'C'] },
      review_status: 'needs_review',
    },
  });
}

// ---------------------------------------------------------------------------
// Ниши (топ EVRK-разделов по числу лидов)
// ---------------------------------------------------------------------------

export interface NicheStat {
  code2: string; // 2-значный раздел EVRK
  leads: number;
  withSite: number;
  noSite: number;
}

export async function getNicheStats(limit = 12): Promise<NicheStat[]> {
  const rows = await db.$queryRaw<
    { code2: string; leads: bigint; with_site: bigint; no_site: bigint }[]
  >`
    SELECT substring(c.evrk2_code from 1 for 2) AS code2,
           count(*) AS leads,
           count(*) FILTER (WHERE e.has_website) AS with_site,
           count(*) FILTER (WHERE NOT e.has_website) AS no_site
    FROM enrichment e
    JOIN companies c ON c.id = e.company_id
    WHERE e.enrich_status = 'rekvizitai_done'
      AND e.lead_branch IN ('A_bad_site', 'B_no_site')
      AND e.credit_risk IN ('A', 'B', 'C')
    GROUP BY 1
    ORDER BY leads DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    code2: r.code2,
    leads: Number(r.leads),
    withSite: Number(r.with_site),
    noSite: Number(r.no_site),
  }));
}

// ---------------------------------------------------------------------------
// Динамика базы — три ведра (active_lead / recheck_later / dead)
// ---------------------------------------------------------------------------

export interface BucketStats {
  active_lead: number;
  recheck_later: number;
  dead: number;
  total: number;
}

export async function getBucketStats(): Promise<BucketStats> {
  const groups = await db.leadState.groupBy({
    by: ['bucket'],
    _count: { company_id: true },
  });
  const out: BucketStats = {
    active_lead: 0,
    recheck_later: 0,
    dead: 0,
    total: 0,
  };
  for (const g of groups) {
    const n = g._count.company_id;
    out.total += n;
    if (g.bucket === 'active_lead') out.active_lead = n;
    if (g.bucket === 'recheck_later') out.recheck_later = n;
    if (g.bucket === 'dead') out.dead = n;
  }
  return out;
}
