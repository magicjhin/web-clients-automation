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
