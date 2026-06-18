/**
 * Аналитика = результативность РАБОТЫ (что я сделал и с каким результатом).
 * «Обработано/Отправлено/Ответы/Сделки» считаются из ВЫДАННЫХ лидов и моей работы,
 * а НЕ из всей базы → пока заглушки (работа не велась). Реальные числа базы — в «Срез базы».
 */
import { PageHeader } from '@/components/page-header';
import { PeriodFilter } from '@/components/period-filter';
import { AnalyticsCard, type Metric } from '@/components/analytics-card';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NicheBarChart, CreditDonutChart } from '@/components/charts';
import { getDashboardStats, getNicheStats } from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';
import { getDict } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const rawPeriod = searchParams.period;
  const periodValue = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) ?? 'all';

  const [stats, niches] = await Promise.all([getDashboardStats(), getNicheStats(10)]);
  const dict = getDict();
  const nicheData = niches.map((n) => ({ name: evrkName(n.code2, dict.evrk), leads: n.leads }));

  const processing: Metric[] = [
    { label: dict.analyticsCard.processed, value: null, live: false },
    { label: dict.analyticsCard.emailsSent, value: null, live: false },
    { label: dict.analyticsCard.audits, value: null, live: false },
  ];
  const results: Metric[] = [
    { label: dict.analyticsCard.replied, value: null, live: false },
    { label: dict.analyticsCard.notReplied, value: null, live: false },
    { label: dict.analyticsCard.deals, value: null, live: false },
  ];

  return (
    <>
      <PageHeader
        title={dict.analyticsPage.title}
        subtitle={dict.analyticsPage.subtitle}
        actions={<PeriodFilter value={periodValue} />}
      />

      <AnalyticsCard processing={processing} results={results} />
      <p className="mb-8 mt-2 px-1 text-xs text-muted-foreground">
        {dict.analyticsPage.workNote}
      </p>

      {/* Срез базы — реальные числа пула, не «работа» */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {dict.analyticsPage.sliceTitle}
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={dict.analyticsPage.leadsABC} value={formatNumber(stats.leadsTotal)} />
        <StatCard label={dict.analyticsPage.withSite} value={formatNumber(stats.withWebsite)} />
        <StatCard label={dict.analyticsPage.withoutSite} value={formatNumber(stats.withoutWebsite)} />
        <StatCard label={dict.analyticsPage.enriched} value={`${stats.enrichedPercent}%`} sub={formatNumber(stats.enrichedCount)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{dict.analyticsPage.nichesTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {nicheData.length ? (
              <NicheBarChart data={nicheData} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{dict.common.noData}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dict.analyticsPage.creditTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreditDonutChart
              a={stats.creditA}
              b={stats.creditB}
              c={stats.creditC}
              d={stats.creditD}
              e={stats.creditE}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
