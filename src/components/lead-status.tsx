'use client';

/**
 * lead-status.tsx — переключатель статуса обработки лида (где помечать «обработан или нет»).
 * UI-first: меняется локально; сохранение и авто-статус (для сайта — по контенту/Resend,
 * для no-site — ручная отметка) подключатся с LeadDelivery/GeneratedContent (Фаза B).
 */
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n/provider';

type Variant = NonNullable<BadgeProps['variant']>;

export function LeadStatus({ initial = 'new' }: { initial?: string }) {
  const [status, setStatus] = useState(initial);
  const { dict } = useI18n();
  const s = dict.leadStatus;
  const STATUSES: { key: string; label: string; variant: Variant }[] = [
    { key: 'new', label: s.new, variant: 'outline' },
    { key: 'in_progress', label: s.inProgress, variant: 'warning' },
    { key: 'done', label: s.done, variant: 'brand' },
    { key: 'replied', label: s.replied, variant: 'success' },
    { key: 'deal', label: s.deal, variant: 'success' },
    { key: 'rejected', label: s.rejected, variant: 'destructive' },
  ];
  const cur = STATUSES.find((s) => s.key === status) ?? STATUSES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
        <Badge variant={cur.variant} className="cursor-pointer gap-1 pr-1.5">
          {cur.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s.key} onClick={() => setStatus(s.key)}>
            <Badge variant={s.variant} className="pointer-events-none">
              {s.label}
            </Badge>
            {s.key === status && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <p className="border-t px-2.5 pb-1 pt-2 text-xs text-muted-foreground">
          {s.saveNote}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
