/**
 * Обзор — отчёт по результативности.
 * Воронка результатов (Обработано→Лиды→Отправлено→Отвечено→Сделки),
 * напоминания «что сделать / кому позвонить», сводка базы, свежие лиды.
 * Метрики рассылки/сделок — заглушки «скоро» (email-gen #15, CRM #17 ещё не построены),
 * заполнятся автоматически, когда появятся данные.
 */
import Link from 'next/link';
import {
  Phone,
  Inbox,
  Database,
  Sparkles,
  ArrowRight,
  ListChecks,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { PeriodFilter } from '@/components/period-filter';
import { PERIODS } from '@/lib/periods';
import { ResultsFunnel, type FunnelStage } from '@/components/results-funnel';
import { CreditBadge, SiteBadge } from '@/components/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getDashboardStats,
  getQueueCount,
  getProcessedSince,
  getLeads,
} from '@/lib/dashboard-queries';
import { formatNumber, formatCurrency, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const rawPeriod = searchParams.period;
  const periodValue = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) ?? 'all';
  const period = PERIODS.find((p) => p.value === periodValue) ?? PERIODS[0];
  const since = period.days ? new Date(Date.now() - period.days * 86400000) : null;

  const [stats, queue, processed, callLeads, recent] = await Promise.all([
    getDashboardStats(),
    getQueueCount(),
    getProcessedSince(since),
    getLeads({ has_phone: 'yes', pageSize: 4 }),
    getLeads({ pageSize: 6 }),
  ]);

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
        title={
          <>
            С возвращением{' '}
            <span className="inline-block" aria-hidden>
              👋
            </span>
          </>
        }
        subtitle="Результативность и задачи на сегодня"
        actions={<PeriodFilter value={periodValue} />}
      />

      {/* Воронка результатов */}
      <Card className="mb-4">
        <CardHeader className="!flex-row items-center justify-between">
          <CardTitle>Воронка результатов</CardTitle>
          <span className="text-sm text-muted-foreground">{period.label.toLowerCase()}</span>
        </CardHeader>
        <CardContent>
          <ResultsFunnel stages={funnel} />
          <p className="mt-3 text-xs text-muted-foreground">
            «Отправлено / Отвечено / Сделки» появятся с генерацией писем и CRM — структура
            готова, цифры заполнятся автоматически.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Напоминания */}
        <Card className="lg:col-span-2">
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Что сделать
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {queue > 0 && (
              <Link
                href="/queue"
                className="flex items-center gap-3 rounded-xl border bg-amber-50/70 p-3 transition-colors hover:bg-amber-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
                  <Inbox className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Проверить лиды в очереди</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(queue)} ждут подтверждения
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                Позвонить
              </p>
              <ul className="divide-y rounded-xl border">
                {callLeads.leads.map((lead) => {
                  const phone = lead.phone ?? lead.mobile;
                  return (
                    <li
                      key={lead.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium hover:underline">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.city ?? '—'} · {evrkName(lead.evrk2_code.slice(0, 2))}
                        </p>
                      </Link>
                      {phone && (
                        <a
                          href={`tel:${phone.replace(/\s/g, '')}`}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {phone}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Напоминания о перезвонах и задачах по сделкам появятся с CRM.
            </p>
          </CardContent>
        </Card>

        {/* Сводка базы */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сводка базы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MiniStat icon={Database} label="Компаний в базе" value={formatNumber(stats.totalCompanies)} />
            <MiniStat
              icon={Sparkles}
              label="Обогащено"
              value={`${stats.enrichedPercent}%`}
              sub={formatNumber(stats.enrichedCount)}
            />
            <MiniStat icon={Inbox} label="На проверке" value={formatNumber(queue)} />
            <Button asChild variant="outline" className="w-full">
              <Link href="/leads">
                Все лиды
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Свежие лиды */}
      <Card className="mt-4">
        <CardHeader className="!flex-row items-center justify-between">
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

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="tabular block font-semibold">{value}</span>
        {sub && <span className="tabular block text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
