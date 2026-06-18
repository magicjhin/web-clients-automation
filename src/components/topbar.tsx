'use client';

import { useState } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { Brand } from '@/components/brand';
import { SidebarNav } from '@/components/sidebar-nav';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/lib/i18n/provider';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Верхняя панель: на мобильных — кнопка меню (Sheet с тёмной навигацией) + бренд;
 * справа — меню пользователя. (Поиск переехал в «Базу».)
 */
export function Topbar() {
  const [open, setOpen] = useState(false);
  const { dict } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Мобильное меню */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="grid h-9 w-9 place-items-center rounded-lg text-foreground hover:bg-accent lg:hidden"
          aria-label={dict.common.openMenu}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetTitle className="px-2 py-3 text-sidebar-foreground">
            <Brand />
          </SheetTitle>
          <div className="mt-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:hidden">
        <Brand tone="dark" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-black text-amber-400">W</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:block">Webvibe</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Webvibe · Tier 4</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">{dict.common.settings}</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/api/logout" className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                {dict.common.logout}
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
