/**
 * header.tsx — sticky top navigation header for the dashboard.
 *
 * Server component. Logout link goes to /api/logout (GET → redirect).
 */

import Link from 'next/link';

interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Leadgen LT' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-700 tracking-tight">{title}</span>
          <span className="hidden sm:inline-block text-xs text-gray-400 font-normal">
            Лидогенерация · Литва
          </span>
        </Link>

        <nav className="flex items-center gap-4" aria-label="Основная навигация">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-brand-700 transition font-medium"
          >
            Лиды
          </Link>
          <a
            href="/api/logout"
            className="text-sm text-gray-400 hover:text-red-500 transition"
            aria-label="Выйти из панели управления"
          >
            Выйти
          </a>
        </nav>
      </div>
    </header>
  );
}
