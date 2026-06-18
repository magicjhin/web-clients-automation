'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems, isActive } from '@/lib/nav';
import { useI18n } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

/**
 * Список пунктов навигации. Активный — лаймовая пилюля с чёрным текстом.
 * Используется и в десктоп-sidebar, и в мобильном Sheet.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dict } = useI18n();

  return (
    <nav className="flex flex-col gap-1" aria-label={dict.common.mainNav}>
      {navItems.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-amber-400 text-black'
                : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{dict.nav[item.key]}</span>
            {item.status === 'soon' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  active
                    ? 'bg-black/10 text-black/70'
                    : 'bg-white/10 text-sidebar-muted'
                )}
              >
                {dict.common.soon}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
