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

export const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: 'all', label: 'За всё время', days: null },
  { value: '90', label: 'Последние 90 дней', days: 90 },
  { value: '30', label: 'Последние 30 дней', days: 30 },
  { value: '7', label: 'Последние 7 дней', days: 7 },
];

export function PeriodFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === 'all') params.delete('period');
    else params.set('period', v);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]" aria-label="Период">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
