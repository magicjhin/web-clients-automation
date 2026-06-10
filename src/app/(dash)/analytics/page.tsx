/**
 * Результативность — отчёт по воронке за период + конверсии + срез базы.
 * Метрики рассылки/сделок — заглушки до email-gen/CRM (заполнятся сами).
 */
import { PageHeader } from '@/components/page-header';
import { PeriodFilter, PERIODS } from '@/components/period-filter';
import { ResultsFunnel, type FunnelStage } from '@/components/results-funnel';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NicheBarChart, CreditDonutChart } from '@/components/charts';
import {
  getDashboardStats,
  getNicheStats,
  getProcessedSince,
  getQueueCount,
} from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const rawPeriod = searchParams.period;
  const periodValue = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) ?? 'all';
  const period = PERIODS.find((p) => p.value === periodValue) ?? PERIODS[0];
  const since = period.days ? new Date(Date.now() - period.days * 86400000) : null;

  const [stats, niches, processed, queue] = await Promise.all([
    getDashboardStats(),
    getNicheStats(10),
    getProcessedSince(since),
    getQueueCount(),
  ]);

  const convToLead = processed ? Math.round((stats.leadsTotal * 100) / processed) : 0;
  const nicheData = niches.map((n) => ({ name: evrkName(n.code2), leads: n.leads }));

  const funnel: FunnelStage[] = [
    { label: 'Обработано', value: processed, live: true },
    { label: 'Лиды (A/B/C)', value: stats.leadsTotal, live: true },
    { label: 'Отправлено', value: null, live: false },
    { label: 'Отвечено', value: null, live: false },
    { label: 'Сделки', value: null, live: false },
  ];

  return (
    <>
      <PageHeader
        title="Результативность"
        subtitle="Воронка и конверсии за период"
        actions={<PeriodFilter value={periodValue} />}
      />

      {/* KPI результативности */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Обработано" value={formatNumber(processed)} />
        <StatCard label="Лиды (A/B/C)" value={formatNumber(stats.leadsTotal)} tone="dark" />
        <StatCard label="Конверсия в лид" value={`${convToLead}%`} accent sub="от обработанных" />
        <StatCard label="На проверке" value={formatNumber(queue)} />
      </div>

      {/* Воронка */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Воронка результатов</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsFunnel stages={funnel} />
          <p className="mt-3 text-xs text-muted-foreground">
            Отчёты по рассылке (доставлено / открыто / отвечено) и сделкам появятся с
            email-gen и CRM.
          </p>
        </CardContent>
      </Card>

      {/* Срез базы */}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Срез базы
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Лиды по нишам</CardTitle>
          </CardHeader>
          <CardContent>
            {nicheData.length ? (
              <NicheBarChart data={nicheData} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
            )}
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
    </>
  );
}
