/**
 * Лиды = ТОЛЬКО выданные нам (рабочий набор на обработку).
 * По каждому — статус + кнопка «Обработать» (аудит→письмо). UI-first: пока стенд-ин
 * из пула обогащения; с lead-select (#14) станет реальной дневной выдачей из LeadDelivery.
 */
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { TodayLeads } from '@/components/today-leads';
import { Card, CardContent } from '@/components/ui/card';
import { getLeads, DAILY_LEAD_QUOTA } from '@/lib/dashboard-queries';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  // Tier 4 ≈ 30 лидов/день. Пока берём срез пула как «выданные».
  const result = await getLeads({ pageSize: DAILY_LEAD_QUOTA });

  return (
    <>
      <PageHeader
        title="Выданные лиды"
        subtitle={`${formatNumber(result.leads.length)} в работе · обрабатывай по одному`}
      />

      <Card className="mb-4 border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
            <Info className="h-5 w-5" />
          </span>
          <p className="text-sm text-foreground/80">
            Это рабочий набор — лиды, выданные на обработку. По каждому кнопка «Обработать»
            запустит аудит и письмо. Скоро здесь будет дневная выдача по тарифу (≈30/день, разные ниши).
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <TodayLeads leads={result.leads} />
      </Card>
    </>
  );
}
