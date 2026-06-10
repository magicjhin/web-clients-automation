'use client';

/**
 * leads-filters.tsx — панель фильтров списка лидов.
 * Клиентский компонент: меняет URL searchParams (шарящиеся/закладочные фильтры).
 * ВАЖНО: фильтра по выручке нет — финансы это атрибут карточки, НЕ фильтр (CLAUDE.md).
 */
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = '__all__';

export function LeadsFilters({
  niches,
}: {
  niches?: { code: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams]
  );

  const get = (key: string) => searchParams.get(key) ?? '';
  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== 'page');

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Поиск" htmlFor="f-q" className="min-w-[180px] flex-1">
        <Input
          id="f-q"
          type="search"
          placeholder="Название компании…"
          defaultValue={get('q')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParam('q', (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => updateParam('q', e.target.value)}
        />
      </Field>

      <Field label="Сайт" htmlFor="f-branch">
        <Select value={get('branch') || ALL} onValueChange={(v) => updateParam('branch', v)}>
          <SelectTrigger id="f-branch" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все</SelectItem>
            <SelectItem value="A_bad_site">Есть сайт</SelectItem>
            <SelectItem value="B_no_site">Нет сайта</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Кредит-риск" htmlFor="f-credit">
        <Select value={get('credit_risk') || ALL} onValueChange={(v) => updateParam('credit_risk', v)}>
          <SelectTrigger id="f-credit" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>A / B / C</SelectItem>
            <SelectItem value="A">A — минимальный</SelectItem>
            <SelectItem value="B">B — низкий</SelectItem>
            <SelectItem value="C">C — средний</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Телефон" htmlFor="f-phone">
        <Select value={get('has_phone') || ALL} onValueChange={(v) => updateParam('has_phone', v)}>
          <SelectTrigger id="f-phone" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все</SelectItem>
            <SelectItem value="yes">Есть телефон</SelectItem>
            <SelectItem value="no">Без телефона</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Ниша" htmlFor="f-niche">
        <Select value={get('niche') || ALL} onValueChange={(v) => updateParam('niche', v)}>
          <SelectTrigger id="f-niche" className="w-[210px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все ниши</SelectItem>
            {niches?.map((n) => (
              <SelectItem key={n.code} value={n.code}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push(pathname))}
        >
          <X className="h-4 w-4" />
          Сбросить
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
