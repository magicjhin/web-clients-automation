import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * KPI-карточка: подпись, крупное значение (табличные цифры), опц. подпись/тренд/иконка.
 * tone='dark' — тёмная акцентная карточка (как dark-карточки в референсах).
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  tone = 'light',
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <Card
      className={cn(
        'p-5',
        dark && 'border-transparent bg-foreground text-background',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-sm font-medium',
            dark ? 'text-background/70' : 'text-muted-foreground'
          )}
        >
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg',
              accent
                ? 'bg-amber-400 text-black'
                : dark
                  ? 'bg-white/10 text-background'
                  : 'bg-secondary text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-3xl font-semibold tracking-tight">
          {value}
        </span>
        {sub && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              dark ? 'text-amber-400' : 'text-muted-foreground'
            )}
          >
            {accent && <ArrowUpRight className="h-3 w-3" />}
            {sub}
          </span>
        )}
      </div>
    </Card>
  );
}
