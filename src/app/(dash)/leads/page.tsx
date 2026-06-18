/**
 * Лиды = ТОЛЬКО выданные нам (рабочий набор на обработку).
 * По каждому — статус + кнопка «Обработать» (аудит→письмо). UI-first: пока стенд-ин
 * из пула обогащения; с lead-select (#14) станет реальной дневной выдачей из LeadDelivery.
 */
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { TodayLeads } from '@/components/today-leads';
import { Card, CardContent } from '@/components/ui/card';
import { getDeliveredLeads } from '@/lib/dashboard-queries';
import { formatNumber } from '@/lib/format';
import { getDict } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  // Tier 4 ≈ 30 лидов/день, 80% с сайтом / 20% без.
  const leads = await getDeliveredLeads();
  const dict = getDict();

  return (
    <>
      <PageHeader
        title={dict.leadsPage.title}
        subtitle={fmt(dict.leadsPage.subtitle, { count: formatNumber(leads.length) })}
      />

      <Card className="mb-4 border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
            <Info className="h-5 w-5" />
          </span>
          <p className="text-sm text-foreground/80">
            {dict.leadsPage.banner}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <TodayLeads leads={leads} />
      </Card>
    </>
  );
}
