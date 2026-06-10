/**
 * leads-filters.tsx — filter bar for the leads list.
 *
 * Client component: manipulates URL searchParams on change.
 * All filter changes trigger a full server-side re-render (no client-side state for data).
 */

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

export function LeadsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 whenever a filter changes
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  const get = (key: string) => searchParams.get(key) ?? '';

  return (
    <div className="flex flex-wrap gap-2 items-end">
      {/* Search */}
      <div className="flex flex-col gap-1 min-w-[160px] flex-1">
        <label htmlFor="filter-q" className="text-xs font-medium text-gray-500">
          Поиск
        </label>
        <input
          id="filter-q"
          type="search"
          placeholder="Название компании..."
          defaultValue={get('q')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('q', (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => updateParam('q', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Branch */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-branch" className="text-xs font-medium text-gray-500">
          Ветка
        </label>
        <select
          id="filter-branch"
          value={get('branch')}
          onChange={(e) => updateParam('branch', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">Все</option>
          <option value="A_bad_site">A · Плохой сайт</option>
          <option value="B_no_site">B · Нет сайта</option>
        </select>
      </div>

      {/* Credit risk */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-credit" className="text-xs font-medium text-gray-500">
          Кредит-риск
        </label>
        <select
          id="filter-credit"
          value={get('credit_risk')}
          onChange={(e) => updateParam('credit_risk', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">A / B / C</option>
          <option value="A">A — минимальный</option>
          <option value="B">B — низкий</option>
          <option value="C">C — средний</option>
        </select>
      </div>

      {/* Has website */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-website" className="text-xs font-medium text-gray-500">
          Сайт
        </label>
        <select
          id="filter-website"
          value={get('has_website')}
          onChange={(e) => updateParam('has_website', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">Все</option>
          <option value="yes">С сайтом</option>
          <option value="no">Без сайта</option>
        </select>
      </div>

      {/* Has phone */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-phone" className="text-xs font-medium text-gray-500">
          Телефон
        </label>
        <select
          id="filter-phone"
          value={get('has_phone')}
          onChange={(e) => updateParam('has_phone', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">Все</option>
          <option value="yes">Есть телефон</option>
          <option value="no">Без телефона</option>
        </select>
      </div>

      {/* Niche (EVRK code prefix) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-niche" className="text-xs font-medium text-gray-500">
          Ниша (EVRK)
        </label>
        <input
          id="filter-niche"
          type="text"
          placeholder="41, 43.2..."
          defaultValue={get('niche')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('niche', (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => updateParam('niche', e.target.value)}
          className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Min revenue */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-revenue" className="text-xs font-medium text-gray-500">
          Выручка от €
        </label>
        <input
          id="filter-revenue"
          type="number"
          min="0"
          step="1000"
          placeholder="50000"
          defaultValue={get('minRevenue')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('minRevenue', (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => updateParam('minRevenue', e.target.value)}
          className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Clear filters */}
      {searchParams.size > 0 && (
        <button
          type="button"
          onClick={() => {
            startTransition(() => {
              router.push(pathname);
            });
          }}
          className="self-end rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}
