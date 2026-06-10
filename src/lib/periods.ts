/**
 * periods.ts — общий конфиг периодов для фильтра «день/неделя/месяц/квартал/год».
 * ВАЖНО: это серверно-безопасный модуль (без 'use client'), чтобы серверные
 * компоненты могли делать PERIODS.find(...). Клиентский PeriodFilter импортирует его же.
 */
export interface Period {
  value: string;
  label: string;
  days: number | null; // null → за всё время
}

export const PERIODS: Period[] = [
  { value: 'all', label: 'За всё время', days: null },
  { value: '90', label: 'Последние 90 дней', days: 90 },
  { value: '30', label: 'Последние 30 дней', days: 30 },
  { value: '7', label: 'Последние 7 дней', days: 7 },
];

export function resolvePeriod(value: string | undefined): Period {
  return PERIODS.find((p) => p.value === value) ?? PERIODS[0];
}
