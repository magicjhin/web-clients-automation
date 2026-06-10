/**
 * База — ВСЯ база лидов A/B/C: срез (ниши + кредит-риск) + фильтруемый/пагинируемый
 * список с выбором по нише. Tier-4/админ-вид «видеть всё». Поглощает бывшие «Ниши».
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadsTable } from '@/components/leads-table';
import { LeadsFilters } from '@/components/leads-filters';
import { Pagination } from '@/components/pagination';
import { NicheBarChart, CreditDonutChart } from '@/components/charts';
import {
  getLeads,
  getDashboardStats,
  getNicheStats,
  type LeadFilters,
} from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function sp(val: string | string[] | undefined): string | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export default async function BasePage({ searchParams }: PageProps) {
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

  const [result, stats, niches] = await Promise.all([
    getLeads(filters),
    getDashboardStats(),
    getNicheStats(60),
  ]);

  const nicheData = niches.slice(0, 8).map((n) => ({ name: evrkName(n.code2), leads: n.leads }));
  // Опции для фильтра — названия ниш (не номера EVRK), только те, что есть в базе.
  const nicheOptions = niches.map((n) => ({ code: n.code2, label: evrkName(n.code2) }));

  return (
    <>
      <PageHeader
        title="База"
        subtitle={`${formatNumber(stats.leadsTotal)} лидов всего · ${formatNumber(result.total)} по фильтрам`}
      />

      {/* Срез базы */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle>Лиды по нишам</CardTitle>
            <span className="text-xs text-muted-foreground">кликни нишу в списке для фильтра</span>
          </CardHeader>
          <CardContent>
            {nicheData.length ? <NicheBarChart data={nicheData} /> : <Empty />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Кредит-риск</CardTitle>
          </CardHeader>
          <CardContent>
            <CreditDonutChart a={stats.creditA} b={stats.creditB} c={stats.creditC} />
          </CardContent>
        </Card>
      </div>

      {/* Фильтры + список */}
      <Card className="mb-4 p-4">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <LeadsFilters niches={nicheOptions} />
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

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Быстрые ниши:{' '}
        {['41', '43', '68', '62', '56'].map((c, i) => (
          <span key={c}>
            {i > 0 && ' · '}
            <Link href={`/base?niche=${c}`} className="text-brand-700 hover:underline">
              {evrkName(c)}
            </Link>
          </span>
        ))}
      </p>
    </>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>;
}
