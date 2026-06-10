/**
 * Аналитика — распределения по нишам, кредит-риску, наличию сайта,
 * и динамика базы (три ведра). Графики из существующих данных.
 */
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NicheBarChart, CreditDonutChart } from '@/components/charts';
import { getDashboardStats, getNicheStats, getBucketStats } from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const [stats, niches, buckets] = await Promise.all([
    getDashboardStats(),
    getNicheStats(10),
    getBucketStats(),
  ]);

  const sitePct = stats.leadsTotal
    ? Math.round((stats.withWebsite * 100) / stats.leadsTotal)
    : 0;
  const nicheData = niches.map((n) => ({ name: evrkName(n.code2), leads: n.leads }));

  return (
    <>
      <PageHeader title="Аналитика" subtitle="Срез базы и лидов" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Лиды всего" value={formatNumber(stats.leadsTotal)} />
        <StatCard label="С сайтом" value={formatNumber(stats.withWebsite)} sub={`${sitePct}%`} />
        <StatCard label="Без сайта" value={formatNumber(stats.withoutWebsite)} />
        <StatCard label="Обогащено" value={`${stats.enrichedPercent}%`} accent sub={formatNumber(stats.enrichedCount)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Лиды по нишам</CardTitle>
          </CardHeader>
          <CardContent>
            {nicheData.length ? (
              <NicheBarChart data={nicheData} />
            ) : (
              <Empty />
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

      {/* Динамика базы — три ведра */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Динамика базы — три ведра</CardTitle>
        </CardHeader>
        <CardContent>
          {buckets.total ? (
            <div className="grid grid-cols-3 gap-4">
              <Bucket label="Активные лиды" value={buckets.active_lead} />
              <Bucket label="На перепроверке" value={buckets.recheck_later} />
              <Bucket label="Закрытые" value={buckets.dead} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ведра заполняются воркером recheck — пока пусто.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>;
}
