/**
 * page.tsx — Dashboard home page.
 *
 * Server component. Reads DB directly via Prisma.
 * Renders: stats header + filterable/paginated leads list.
 * Filters live in URL searchParams — shareable and bookmarkable.
 *
 * Protected by middleware.ts (requires valid dash_session cookie).
 */

import { Suspense } from 'react';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { LeadsTable } from '@/components/leads-table';
import { LeadsFilters } from '@/components/leads-filters';
import { Pagination } from '@/components/pagination';
import { getDashboardStats, getLeads } from '@/lib/dashboard-queries';
import { formatNumber } from '@/lib/format';
import type { LeadFilters } from '@/lib/dashboard-queries';

// Force dynamic rendering — data changes frequently
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function sp(val: string | string[] | undefined): string | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // Build filters from URL params
  const filters: LeadFilters = {
    branch: sp(searchParams.branch) as LeadFilters['branch'],
    credit_risk: sp(searchParams.credit_risk) as LeadFilters['credit_risk'],
    has_website: sp(searchParams.has_website) as LeadFilters['has_website'],
    has_phone: sp(searchParams.has_phone) as LeadFilters['has_phone'],
    niche: sp(searchParams.niche),
    minRevenue: sp(searchParams.minRevenue) ? Number(sp(searchParams.minRevenue)) : undefined,
    q: sp(searchParams.q),
    page: sp(searchParams.page) ? Number(sp(searchParams.page)) : 1,
    pageSize: sp(searchParams.pageSize) ? Number(sp(searchParams.pageSize)) : 25,
  };

  // Parallel fetch: stats + leads
  const [stats, leadsResult] = await Promise.all([
    getDashboardStats(),
    getLeads(filters),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stats header ────────────────────────────────────────── */}
        <section aria-label="Статистика">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Обзор</h1>

          {/* Row 1: top-level numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
            <StatCard
              label="Компаний в базе"
              value={formatNumber(stats.totalCompanies)}
            />
            <StatCard
              label="Обогащено"
              value={formatNumber(stats.enrichedCount)}
              sub={`${stats.enrichedPercent}% от всех`}
              accent="blue"
            />
            <StatCard
              label="Лиды"
              value={formatNumber(stats.leadsTotal)}
              accent="green"
            />
            <StatCard
              label="Есть сайт"
              value={formatNumber(stats.leadsABadSite)}
            />
            <StatCard
              label="Нет сайта"
              value={formatNumber(stats.leadsBNoSite)}
              accent="blue"
            />
          </div>

          {/* Row 2: breakdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="С сайтом"
              value={formatNumber(stats.withWebsite)}
            />
            <StatCard
              label="Без сайта"
              value={formatNumber(stats.withoutWebsite)}
            />
            <StatCard
              label="Риск A"
              value={formatNumber(stats.creditA)}
              accent="green"
            />
            <StatCard
              label="Риск B"
              value={formatNumber(stats.creditB)}
            />
            <StatCard
              label="Риск C"
              value={formatNumber(stats.creditC)}
              accent="amber"
            />
          </div>
        </section>

        {/* ── Leads list ──────────────────────────────────────────── */}
        <section aria-label="Список лидов">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Лиды
              <span className="ml-2 text-base font-normal text-gray-400 tabular-nums">
                ({formatNumber(leadsResult.total)})
              </span>
            </h2>
          </div>

          {/* Filters — client component inside Suspense to avoid searchParams blocking */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-4">
            <Suspense fallback={<div className="h-10 animate-pulse bg-gray-100 rounded-lg" />}>
              <LeadsFilters />
            </Suspense>
          </div>

          {/* Table / cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <LeadsTable leads={leadsResult.leads} />

            <Suspense fallback={null}>
              <Pagination
                page={leadsResult.page}
                pageCount={leadsResult.pageCount}
                total={leadsResult.total}
                pageSize={leadsResult.pageSize}
              />
            </Suspense>
          </div>
        </section>

      </main>
    </div>
  );
}
