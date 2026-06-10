/**
 * nav.tsx — Application navigation.
 *
 * Desktop: top header with nav links.
 * Mobile (PWA, mobile-first): bottom tab bar pinned at the bottom of the viewport.
 *
 * Client component — uses usePathname for active state detection.
 */

'use client';

import React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavProps {
  reviewCount?: number;
}

// Nav items definition
interface NavItem {
  href: string;
  label: string;
  icon: ({ className }: { className?: string }) => React.ReactElement;
  exact: boolean;
  badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Сводка',
    icon: HomeIcon,
    exact: true,
  },
  {
    href: '/review',
    label: 'Проверка',
    icon: CheckIcon,
    exact: false,
    badge: true,
  },
  {
    href: '/leads',
    label: 'База лидов',
    icon: ListIcon,
    exact: false,
  },
];

export function Nav({ reviewCount = 0 }: NavProps) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Desktop top header ─────────────────────────────────────────── */}
      <header className="hidden sm:block sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg font-bold text-brand-700 tracking-tight">Leadgen LT</span>
            <span className="hidden md:inline-block text-xs text-gray-400 font-normal">
              Лидогенерация · Литва
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1" aria-label="Основная навигация">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition
                    ${active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {badge && reviewCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 tabular-nums">
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="ml-2 pl-2 border-l border-gray-200">
              <a
                href="/api/logout"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                aria-label="Выйти из панели управления"
              >
                <LogoutIcon className="h-4 w-4" aria-hidden="true" />
                Выйти
              </a>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Mobile top bar (brand name only, no nav — tabs are at bottom) ── */}
      <header className="sm:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="h-12 flex items-center justify-center">
          <span className="text-base font-bold text-brand-700 tracking-tight">Leadgen LT</span>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom"
        aria-label="Основная навигация"
      >
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition
                  ${active ? 'text-brand-700' : 'text-gray-400 hover:text-gray-600'}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-brand-700' : 'text-gray-400'}`}
                    aria-hidden="true"
                  />
                  {badge && reviewCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5 tabular-nums">
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            );
          })}

          {/* Logout slot */}
          <a
            href="/api/logout"
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 hover:text-red-500 transition"
            aria-label="Выйти"
          >
            <LogoutIcon className="h-5 w-5" aria-hidden="true" />
            <span>Выйти</span>
          </a>
        </div>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no external library)
// ---------------------------------------------------------------------------

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
