/**
 * leads/page.tsx — База лидов (/leads).
 *
 * Server component. Full filterable + paginated leads list.
 * Moved here from the old root page.tsx — content is identical,
 * path changed from / to /leads.
 *
 * Protected by middleware.ts.
 */

import { Suspense } from 'react';
import { Nav } from '@/components/nav';
import { LeadsTable } from '@/components/leads-table';
import { LeadsFilters } from '@/components/leads-filters';
import { Pagination } from '@/components/pagination';
import { getLeads } from '@/lib/dashboard-queries';
import { getCurrentSubscriberId } from '@/lib/subscriber';
import { formatNumber } from '@/lib/format';
import type { LeadFilters } from '@/lib/dashboard-queries';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function sp(val: string | string[] | undefined): string | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export default async function LeadsPage({ searchParams }: PageProps) {
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

  // subscriberId fetched for future use (tenant isolation); getLeads currently
  // uses global scope but will accept it once backend adds subscriber support
  await getCurrentSubscriberId();

  const leadsResult = await getLeads(filters);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-6">
      <Nav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              База лидов
              <span className="ml-2 text-base font-normal text-gray-400 tabular-nums">
                ({formatNumber(leadsResult.total)})
              </span>
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Действующие компании с квалифицированными лидами
            </p>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <Suspense fallback={<div className="h-10 animate-pulse bg-gray-100 rounded-lg" />}>
            <LeadsFilters />
          </Suspense>
        </div>

        {/* ── Table / cards ───────────────────────────────────────── */}
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

      </main>
    </div>
  );
}
