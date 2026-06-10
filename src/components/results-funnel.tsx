import { ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface FunnelStage {
  label: string;
  value: number | null; // null → ещё нет данных
  live: boolean; // есть ли реальный источник данных
  hint?: string;
}

/**
 * Воронка результатов: Обработано → Лиды → Отправлено → Отвечено → Сделки.
 * Живые стадии показывают число + конверсию от предыдущей живой стадии;
 * стадии без бэкенда (рассылка/сделки) приглушены с меткой «скоро».
 */
export function ResultsFunnel({ stages }: { stages: FunnelStage[] }) {
  let prevLive: number | null = null;

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
      {stages.map((s, i) => {
        const conv =
          s.live && s.value != null && prevLive != null && prevLive > 0
            ? Math.round((s.value / prevLive) * 100)
            : null;
        if (s.live && s.value != null) prevLive = s.value;

        return (
          <div key={s.label} className="flex flex-1 items-center">
            <div
              className={cn(
                'flex-1 rounded-xl border p-4',
                s.live ? 'bg-card' : 'border-dashed bg-muted/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                {!s.live && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    скоро
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    'tabular text-2xl font-semibold tracking-tight',
                    !s.live && 'text-muted-foreground/50'
                  )}
                >
                  {s.live && s.value != null ? formatNumber(s.value) : '—'}
                </span>
                {conv != null && (
                  <span className="tabular text-xs font-medium text-amber-600">{conv}%</span>
                )}
              </div>
            </div>
            {i < stages.length - 1 && (
              <ChevronRight className="mx-1 hidden h-4 w-4 shrink-0 text-muted-foreground/40 md:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
