/**
 * Обзор = «пульт» Tier 4.
 * Сверху вниз: напоминания «Что сделать» → карточка аналитики за период
 * (обработка/результаты) → сегодняшние (выданные) лиды с кнопкой «Обработать».
 * UI-first: метрики рассылки/сделок — заглушки до email-gen/CRM; сегодняшние
 * лиды берём из пула обогащения (позже → LeadDelivery).
 */
import Link from 'next/link';
import { Phone, ListChecks, ChevronRight, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { PeriodFilter } from '@/components/period-filter';
import { AnalyticsCard, type Metric } from '@/components/analytics-card';
import { TodayLeads } from '@/components/today-leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getLeads,
  getDeliveredLeads,
  DAILY_LEAD_QUOTA,
} from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';
import { getDict } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function CockpitPage({ searchParams }: PageProps) {
  const dict = getDict();
  const rawPeriod = searchParams.period;
  const periodValue = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) ?? 'all';
  // Период пока только UI-контрол — метрики работы заглушки до подключения генерации/рассылки.

  const [delivered, callLeads] = await Promise.all([
    getDeliveredLeads(),
    getLeads({ has_phone: 'yes', pageSize: 3 }),
  ]);

  // «Обработано» = лиды, которые Я обработал (позвонил / аудит+письмо отправлено),
  // а НЕ все обогащённые компании. Пока 0 (работа не велась) → заглушки «—/скоро».
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
        title={
          <>
            {dict.cockpit.welcomeBack}{' '}
            <span className="inline-block" aria-hidden>
              👋
            </span>
          </>
        }
        subtitle={dict.cockpit.subtitle}
        actions={<PeriodFilter value={periodValue} />}
      />

      {/* Напоминания — сверху */}
      <Card className="mb-4">
        <CardHeader className="!flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {dict.cockpit.todo}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href="/leads"
            className="flex items-center gap-3 rounded-xl border bg-amber-50/70 p-3 transition-colors hover:bg-amber-50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{dict.cockpit.processLeads}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(dict.cockpit.processLeadsHint, {
                  count: formatNumber(DAILY_LEAD_QUOTA),
                })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {dict.cockpit.call}
            </p>
            <ul className="divide-y rounded-xl border">
              {callLeads.leads.map((lead) => {
                const phone = lead.phone ?? lead.mobile;
                return (
                  <li key={lead.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium hover:underline">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.city ?? '—'} · {evrkName(lead.evrk2_code.slice(0, 2), dict.evrk)}
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
            {dict.cockpit.remindersHint}
          </p>
        </CardContent>
      </Card>

      {/* Аналитика за период */}
      <div className="mb-4">
        <AnalyticsCard processing={processing} results={results} />
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {dict.cockpit.periodNote}
        </p>
      </div>

      {/* Сегодняшние лиды */}
      <Card>
        <CardHeader className="!flex-row items-center justify-between">
          <CardTitle>{dict.cockpit.todayLeads}</CardTitle>
          <Link href="/leads" className="text-sm text-brand-700 hover:underline">
            {dict.cockpit.allDelivered}
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <TodayLeads leads={delivered.slice(0, 8)} />
        </CardContent>
      </Card>
    </>
  );
}
