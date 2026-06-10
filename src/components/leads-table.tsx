'use client';

/**
 * leads-table.tsx — responsive leads list.
 *
 * Desktop (lg+): HTML table with all columns.
 * Mobile (<lg): stacked card per lead with tap-to-call + site link.
 *
 * Pure presentational component — receives data from the server page.
 * Uses Next.js <Link> for row/card navigation.
 */

import Link from 'next/link';
import { BranchBadge, CreditBadge } from '@/components/badges';
import { formatCurrency, formatDomain } from '@/lib/format';
import type { LeadRow } from '@/lib/dashboard-queries';

interface LeadsTableProps {
  leads: LeadRow[];
}

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 mb-3 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M9 17H5a2 2 0 01-2-2V7a2 2 0 012-2h4m0 0V3m0 2h6m0 0V3m0 2h4a2 2 0 012 2v8a2 2 0 01-2 2h-4m0 0v2"
          />
        </svg>
        <p className="text-sm">Лиды не найдены. Попробуйте изменить фильтры.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile cards (< lg) ─────────────────────────────────────── */}
      <ul className="lg:hidden divide-y divide-gray-100" role="list">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link
              href={`/lead/${lead.id}`}
              className="flex flex-col gap-2 px-4 py-4 hover:bg-gray-50 transition active:bg-gray-100"
            >
              {/* Name + city */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{lead.name}</p>
                  {lead.city && (
                    <p className="text-xs text-gray-500 mt-0.5">{lead.city}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <CreditBadge risk={lead.credit_risk} />
                  <BranchBadge branch={lead.lead_branch} />
                </div>
              </div>

              {/* Bottom row: revenue + phone/site */}
              <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span className="tabular-nums font-medium text-gray-800">
                  {formatCurrency(lead.revenue)}
                </span>

                <div className="flex items-center gap-3">
                  {(lead.phone ?? lead.mobile) && (
                    /* Stop propagation so tap-to-call doesn't navigate to detail */
                    <a
                      href={`tel:${(lead.phone ?? lead.mobile)!.replace(/\s/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-brand-600 font-medium"
                      aria-label={`Позвонить ${lead.name}`}
                    >
                      <PhoneIcon />
                      {lead.phone ?? lead.mobile}
                    </a>
                  )}
                  {lead.website_url && (
                    <a
                      href={lead.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline truncate max-w-[120px]"
                      aria-label={`Сайт ${lead.name}`}
                    >
                      {formatDomain(lead.website_url)}
                    </a>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── Desktop table (lg+) ─────────────────────────────────────── */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Компания</th>
              <th className="px-4 py-3">Ветка</th>
              <th className="px-4 py-3">Риск</th>
              <th className="px-4 py-3 text-right">Выручка</th>
              <th className="px-4 py-3">Телефон</th>
              <th className="px-4 py-3">Сайт</th>
              <th className="px-4 py-3">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-gray-50 transition cursor-pointer"
              >
                <td className="px-4 py-3">
                  <Link href={`/lead/${lead.id}`} className="block">
                    <span className="font-medium text-gray-900">{lead.name}</span>
                    {lead.city && (
                      <span className="block text-xs text-gray-400">{lead.city}</span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <BranchBadge branch={lead.lead_branch} />
                </td>
                <td className="px-4 py-3">
                  <CreditBadge risk={lead.credit_risk} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 font-medium">
                  {formatCurrency(lead.revenue)}
                </td>
                <td className="px-4 py-3">
                  {(lead.phone ?? lead.mobile) ? (
                    <a
                      href={`tel:${(lead.phone ?? lead.mobile)!.replace(/\s/g, '')}`}
                      className="text-brand-600 hover:underline whitespace-nowrap"
                    >
                      {lead.phone ?? lead.mobile}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.website_url ? (
                    <a
                      href={lead.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate max-w-[180px] block"
                    >
                      {formatDomain(lead.website_url)}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-blue-600 hover:underline truncate max-w-[180px] block"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Small inline SVG icons — no icon library needed.
function PhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
