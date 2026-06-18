'use client';

/**
 * language-switcher.tsx — переключатель языка кабинета (RU / LT / EN).
 * Пишет выбор в cookie `locale` и делает router.refresh() — серверные компоненты
 * перерисовываются с новым словарём (URL не меняется).
 */
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Languages, Check } from 'lucide-react';
import {
  locales,
  localeNames,
  localeShort,
  LOCALE_COOKIE,
  LOCALE_MAX_AGE,
  type Locale,
} from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        aria-label={dict.language.label}
        disabled={isPending}
      >
        <Languages className="h-4 w-4" />
        <span className="tabular">{localeShort[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{dict.language.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => selectLocale(l)}
            className="flex items-center justify-between"
          >
            <span>{localeNames[l]}</span>
            <Check
              className={cn(
                'h-4 w-4',
                l === locale ? 'opacity-100' : 'opacity-0',
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
