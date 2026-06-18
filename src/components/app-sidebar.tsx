import { LogOut } from 'lucide-react';
import { Brand } from '@/components/brand';
import { SidebarNav } from '@/components/sidebar-nav';
import { getDict } from '@/lib/i18n/server';

/**
 * Десктопный sidebar — тёмный, фиксированный. Скрыт на мобильных
 * (там навигация открывается из топбара через Sheet).
 */
export function AppSidebar() {
  const dict = getDict();
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-0 flex h-svh flex-col bg-sidebar p-4 text-sidebar-foreground">
        <div className="px-2 py-3">
          <Brand />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <div className="mt-2 border-t border-sidebar-border pt-3">
          <a
            href="/api/logout"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {dict.common.logout}
          </a>
        </div>
      </div>
    </aside>
  );
}
