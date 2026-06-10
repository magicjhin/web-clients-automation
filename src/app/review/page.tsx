/**
 * review/page.tsx — Очередь проверки (/review).
 *
 * Server component. Shows all items from getReviewQueue:
 *  - reason='audit_ready'  → аудит готов, показать PageSpeed, пометка
 *  - reason='needs_review' → требует ручной проверки матча сайта
 *
 * Protected by middleware.ts.
 */

import Link from 'next/link';
import { Nav } from '@/components/nav';
import { BranchBadge, CreditBadge, PageSpeedBadge } from '@/components/badges';
import { getReviewQueue } from '@/lib/dashboard-queries';
import { getCurrentSubscriberId } from '@/lib/subscriber';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const subscriberId = await getCurrentSubscriberId();
  const items = await getReviewQueue(subscriberId);

  const auditReadyItems = items.filter((i) => i.reason === 'audit_ready');
  const needsReviewItems = items.filter((i) => i.reason === 'needs_review');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-6">
      <Nav reviewCount={items.length} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Требует проверки
            {items.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5 tabular-nums">
                {items.length}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Лиды, ожидающие ручного подтверждения перед работой
          </p>
        </div>

        {/* ── Empty state ─────────────────────────────────────────── */}
        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
            <p className="text-3xl mb-3" aria-hidden="true">✓</p>
            <p className="text-base font-medium text-gray-700">Очередь пуста</p>
            <p className="mt-1 text-sm text-gray-500">
              Нет элементов, требующих ручной проверки
            </p>
          </div>
        )}

        {/* ── Audit ready section ──────────────────────────────────── */}
        {auditReadyItems.length > 0 && (
          <section aria-labelledby="audit-ready-heading">
            <h2 id="audit-ready-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Аудит готов — проверить результат
              <span className="ml-2 text-xs font-normal normal-case text-gray-400">
                ({auditReadyItems.length})
              </span>
            </h2>
            <ul className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100" role="list">
              {auditReadyItems.map((item) => (
                <li key={item.companyId}>
                  <Link
                    href={`/lead/${item.companyId}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-gray-50 transition"
                  >
                    {/* Company info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      {item.city && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.city}</p>
                      )}
                      <AuditStatusLabel status={item.audit_status} />
                    </div>

                    {/* Badges + PageSpeed */}
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      {item.lead_branch && <BranchBadge branch={item.lead_branch} />}
                      {item.credit_risk && <CreditBadge risk={item.credit_risk} />}
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Аудит готов
                      </span>
                      {item.pagespeed_mobile != null && (
                        <PageSpeedBadge score={item.pagespeed_mobile} label="Mobile" />
                      )}
                      {item.pagespeed_desktop != null && (
                        <PageSpeedBadge score={item.pagespeed_desktop} label="Desktop" />
                      )}
                      <ChevronIcon />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Needs manual review section ──────────────────────────── */}
        {needsReviewItems.length > 0 && (
          <section aria-labelledby="needs-review-heading">
            <h2 id="needs-review-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Требует ручной проверки матча
              <span className="ml-2 text-xs font-normal normal-case text-gray-400">
                ({needsReviewItems.length})
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Алгоритм не смог однозначно подтвердить сайт компании. Откройте карточку, проверьте
              вручную и подтвердите или отклоните.
            </p>
            <ul className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100" role="list">
              {needsReviewItems.map((item) => (
                <li key={item.companyId}>
                  <Link
                    href={`/lead/${item.companyId}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-gray-50 transition"
                  >
                    {/* Company info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      {item.city && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.city}</p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      {item.lead_branch && <BranchBadge branch={item.lead_branch} />}
                      {item.credit_risk && <CreditBadge risk={item.credit_risk} />}
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Ручная проверка
                      </span>
                      <ChevronIcon />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AuditStatusLabel({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    done: { label: 'Готов', cls: 'text-green-600' },
    running: { label: 'Считается...', cls: 'text-amber-600' },
    queued: { label: 'В очереди', cls: 'text-blue-600' },
    failed: { label: 'Ошибка аудита', cls: 'text-red-600' },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <p className={`text-xs mt-0.5 font-medium ${entry.cls}`}>
      Аудит: {entry.label}
    </p>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-gray-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
