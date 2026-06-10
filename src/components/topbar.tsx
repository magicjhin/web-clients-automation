'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, LogOut } from 'lucide-react';
import { Brand } from '@/components/brand';
import { SidebarNav } from '@/components/sidebar-nav';
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
 * на десктопе — поиск по лидам; справа — меню пользователя.
 */
export function Topbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? '';
    router.push(q ? `/leads?q=${encodeURIComponent(q)}` : '/leads');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Мобильное меню */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="grid h-9 w-9 place-items-center rounded-lg text-foreground hover:bg-accent lg:hidden"
          aria-label="Открыть меню"
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

      {/* Поиск (десктоп) */}
      <form onSubmit={onSearch} className="relative hidden max-w-sm flex-1 lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          type="search"
          placeholder="Поиск компании…"
          className="h-9 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
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
              <a href="/settings">Настройки</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/api/logout" className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Выйти
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
