/**
 * pagination.tsx — URL-driven pagination controls.
 *
 * Client component: generates links with updated page= searchParam.
 * Uses Next.js <Link> so navigation is client-side but URL-bookmarkable.
 */

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}

export function Pagination({ page, pageCount, total, pageSize }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    return `${pathname}?${params.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build page numbers to show: always first, last, current ± 1
  const pages: (number | 'ellipsis')[] = [];
  const add = new Set<number>();

  [1, page - 1, page, page + 1, pageCount].forEach((p) => {
    if (p >= 1 && p <= pageCount) add.add(p);
  });

  const sorted = Array.from(add).sort((a, b) => a - b);
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push('ellipsis');
    pages.push(p);
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
      <p className="text-xs text-gray-500 tabular-nums">
        {from}–{to} из {total}
      </p>

      <nav aria-label="Пагинация" className="flex items-center gap-1">
        <PagLink
          href={buildHref(page - 1)}
          disabled={page <= 1}
          aria-label="Предыдущая страница"
        >
          ←
        </PagLink>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ell-${i}`} className="px-2 text-gray-400 text-sm select-none">
              …
            </span>
          ) : (
            <PagLink
              key={p}
              href={buildHref(p)}
              active={p === page}
              aria-label={`Страница ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </PagLink>
          ),
        )}

        <PagLink
          href={buildHref(page + 1)}
          disabled={page >= pageCount}
          aria-label="Следующая страница"
        >
          →
        </PagLink>
      </nav>
    </div>
  );
}

interface PagLinkProps {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  'aria-label'?: string;
  'aria-current'?: 'page' | undefined;
}

function PagLink({ href, children, disabled, active, ...aria }: PagLinkProps) {
  const base =
    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition';
  if (disabled) {
    return (
      <span className={`${base} text-gray-300 cursor-not-allowed`} {...aria}>
        {children}
      </span>
    );
  }
  if (active) {
    return (
      <span
        className={`${base} bg-brand-600 text-white`}
        {...aria}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-gray-600 hover:bg-gray-100`}
      {...aria}
    >
      {children}
    </Link>
  );
}
