/**
 * Лиды — фильтруемый/пагинируемый список. Фильтры живут в URL (шарятся).
 */
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadsTable } from '@/components/leads-table';
import { LeadsFilters } from '@/components/leads-filters';
import { Pagination } from '@/components/pagination';
import { getLeads, type LeadFilters } from '@/lib/dashboard-queries';
import { formatNumber } from '@/lib/format';

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
    q: sp(searchParams.q),
    page: sp(searchParams.page) ? Number(sp(searchParams.page)) : 1,
    pageSize: 25,
  };

  const result = await getLeads(filters);

  return (
    <>
      <PageHeader
        title="Лиды"
        subtitle={`${formatNumber(result.total)} компаний по текущим фильтрам`}
      />

      <Card className="mb-4 p-4">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <LeadsFilters />
        </Suspense>
      </Card>

      <Card className="overflow-hidden p-0">
        <LeadsTable leads={result.leads} />
        <Suspense fallback={null}>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
          />
        </Suspense>
      </Card>
    </>
  );
}
