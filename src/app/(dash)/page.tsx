/**
 * Обзор — KPI + распределения + свежие лиды. Server component, читает БД напрямую.
 */
import Link from 'next/link';
import { Database, Sparkles, Users, Inbox, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { CreditBadge, SiteBadge } from '@/components/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NicheBarChart, CreditDonutChart } from '@/components/charts';
import {
  getDashboardStats,
  getNicheStats,
  getQueueCount,
  getLeads,
} from '@/lib/dashboard-queries';
import { formatNumber, formatCurrency, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [stats, niches, queue, recent] = await Promise.all([
    getDashboardStats(),
    getNicheStats(7),
    getQueueCount(),
    getLeads({ pageSize: 6 }),
  ]);

  const nicheData = niches.map((n) => ({ name: evrkName(n.code2), leads: n.leads }));

  return (
    <>
      <PageHeader
        title={
          <>
            С возвращением{' '}
            <span className="inline-block" aria-hidden>
              👋
            </span>
          </>
        }
        subtitle="Сводка по базе и лидам на сегодня"
        actions={
          <Button asChild>
            <Link href="/leads">
              Все лиды
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Компаний в базе"
          value={formatNumber(stats.totalCompanies)}
          icon={Database}
        />
        <StatCard
          label="Обогащено"
          value={`${stats.enrichedPercent}%`}
          sub={formatNumber(stats.enrichedCount)}
          icon={Sparkles}
          accent
        />
        <StatCard
          label="Лиды"
          value={formatNumber(stats.leadsTotal)}
          sub="A / B / C"
          icon={Users}
          tone="dark"
        />
        <StatCard
          label="Ждут проверки"
          value={formatNumber(queue)}
          icon={Inbox}
        />
      </div>

      {/* Распределения */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle>Топ ниш по лидам</CardTitle>
            <Link href="/niches" className="text-sm text-brand-700 hover:underline">
              Все ниши
            </Link>
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
            <div className="mt-3 space-y-1.5 text-sm">
              <Legend color="#65a30d" label="A — минимальный" value={stats.creditA} />
              <Legend color="#94a3b8" label="B — низкий" value={stats.creditB} />
              <Legend color="#f59e0b" label="C — средний" value={stats.creditC} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Свежие лиды */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Свежие лиды</CardTitle>
          <Link href="/leads" className="text-sm text-brand-700 hover:underline">
            Смотреть все
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ul className="divide-y">
            {recent.leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.city ?? '—'} · {evrkName(lead.evrk2_code.slice(0, 2))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular hidden text-sm font-medium sm:block">
                      {formatCurrency(lead.revenue)}
                    </span>
                    <CreditBadge risk={lead.credit_risk} />
                    <SiteBadge branch={lead.lead_branch} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-medium">{formatNumber(value)}</span>
    </div>
  );
}
