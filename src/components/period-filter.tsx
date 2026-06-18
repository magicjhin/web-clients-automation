'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERIODS } from '@/lib/periods';
import { useI18n } from '@/lib/i18n/provider';

/** value периода → ключ подписи в словаре. */
const PERIOD_LABEL: Record<string, 'all' | 'last90' | 'last30' | 'last7'> = {
  all: 'all',
  '90': 'last90',
  '30': 'last30',
  '7': 'last7',
};

export function PeriodFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { dict } = useI18n();

  function onChange(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === 'all') params.delete('period');
    else params.set('period', v);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]" aria-label={dict.periods.ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {dict.periods[PERIOD_LABEL[p.value]]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
