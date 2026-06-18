import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { getDict } from '@/lib/i18n/server';

export interface Metric {
  label: string;
  value: number | null; // null → нет данных (заглушка «—/скоро»)
  live: boolean;
}

/**
 * Карточка аналитики «пульта»: два блока за выбранный период.
 * Обработка (обработано/писем/аудитов) + Результаты (ответы/сделки).
 * Живые цифры где есть, остальное — «—» с меткой «скоро».
 */
export function AnalyticsCard({
  processing,
  results,
}: {
  processing: Metric[];
  results: Metric[];
}) {
  const dict = getDict();
  return (
    <Card>
      <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
        <Block title={dict.analyticsCard.processing} metrics={processing} soon={dict.common.soon} />
        <Block title={dict.analyticsCard.results} metrics={results} soon={dict.common.soon} accent />
      </CardContent>
    </Card>
  );
}

function Block({
  title,
  metrics,
  soon,
  accent,
}: {
  title: string;
  metrics: Metric[];
  soon: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              {!m.live && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  {soon}
                </span>
              )}
            </div>
            <p
              className={cn(
                'tabular mt-1.5 text-2xl font-semibold tracking-tight',
                !m.live && 'text-muted-foreground/50',
                accent && m.live && 'text-amber-600'
              )}
            >
              {m.live && m.value != null ? formatNumber(m.value) : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
