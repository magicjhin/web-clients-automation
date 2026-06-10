/**
 * page.tsx — Cockpit / Summary page (/).
 *
 * Server component. Shows:
 *  1. Sales funnel stats (getFunnelStats) with period switcher via searchParams
 *  2. Call reminders (getCallReminders) — overdue ones highlighted red
 *  3. Review queue preview (getReviewQueue) — top 5 items + link to /review
 *  4. Secondary base stats (getDashboardStats) — compact second row
 *
 * Protected by middleware.ts (requires valid dash_session cookie).
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/stat-card';
import { BranchBadge, CreditBadge } from '@/components/badges';
import {
  getDashboardStats,
  getFunnelStats,
  getCallReminders,
  getReviewQueue,
} from '@/lib/dashboard-queries';
import { getCurrentSubscriberId } from '@/lib/subscriber';
import { formatNumber, formatDate } from '@/lib/format';
import type { FunnelPeriod } from '@/lib/dashboard-queries';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function sp(val: string | string[] | undefined): string | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

const VALID_PERIODS: FunnelPeriod[] = ['week', 'month', 'quarter', 'all'];

function parsePeriod(raw: string | undefined): FunnelPeriod {
  if (raw && VALID_PERIODS.includes(raw as FunnelPeriod)) return raw as FunnelPeriod;
  return 'month';
}

const PERIOD_LABELS: Record<FunnelPeriod, string> = {
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  all: 'Всё время',
};

export default async function SummaryPage({ searchParams }: PageProps) {
  const period = parsePeriod(sp(searchParams.period));

  const subscriberId = await getCurrentSubscriberId();

  const [stats, funnel, reminders, reviewItems] = await Promise.all([
    getDashboardStats(),
    getFunnelStats(subscriberId, period),
    getCallReminders(subscriberId),
    getReviewQueue(subscriberId),
  ]);

  const reviewCount = reviewItems.length;
  const topReviews = reviewItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-6">
      <Nav reviewCount={reviewCount} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* ── Page title ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Сводка</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Воронка, напоминания и очередь проверки
          </p>
        </div>

        {/* ── Funnel ──────────────────────────────────────────────── */}
        <section aria-labelledby="funnel-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="funnel-heading" className="text-base font-semibold text-gray-800">
              Воронка продаж
              {funnel.totalQualifying > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400 tabular-nums">
                  ({formatNumber(funnel.totalQualifying)} квалифицировано)
                </span>
              )}
            </h2>

            {/* Period switcher */}
            <nav aria-label="Период воронки" className="flex items-center gap-1 flex-wrap">
              {VALID_PERIODS.map((p) => (
                <Link
                  key={p}
                  href={`/?period=${p}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition
                    ${period === p
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  aria-current={period === p ? 'true' : undefined}
                >
                  {PERIOD_LABELS[p]}
                </Link>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <FunnelCard label="Не обработано" value={funnel.notProcessed} accent="default" />
            <FunnelCard label="В работе" value={funnel.inWork} accent="blue" />
            <FunnelCard label="Ответили" value={funnel.responded} accent="green" />
            <FunnelCard label="Игнор" value={funnel.ignored} accent="default" />
            <FunnelCard label="Отказ" value={funnel.refused} accent="amber" />
            <FunnelCard label="Сделки" value={funnel.won} accent="green" />
          </div>
        </section>

        {/* ── Call reminders ──────────────────────────────────────── */}
        <section aria-labelledby="reminders-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="reminders-heading" className="text-base font-semibold text-gray-800">
              Кому позвонить
            </h2>
          </div>

          {reminders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-8 text-center">
              <p className="text-2xl mb-2" aria-hidden="true">📞</p>
              <p className="text-sm text-gray-500">Напоминаний нет — всё спокойно</p>
            </div>
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100" role="list">
              {reminders.map((r) => (
                <li
                  key={r.companyId}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    r.overdue ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/lead/${r.companyId}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-700 transition truncate block"
                    >
                      {r.name}
                    </Link>
                    {r.city && (
                      <p className="text-xs text-gray-400 truncate">{r.city}</p>
                    )}
                    <p className={`text-xs mt-0.5 tabular-nums ${r.overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {r.overdue ? 'Просрочено · ' : ''}
                      {formatDate(r.next_call_at)}
                    </p>
                    {r.note && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate italic">{r.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <OutcomeBadge outcome={r.outcome} />
                    {(r.phone ?? r.mobile) && (
                      <a
                        href={`tel:${(r.phone ?? r.mobile)!.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-brand-700 transition"
                        aria-label={`Позвонить ${r.name}`}
                      >
                        <PhoneIcon />
                        Звонок
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Review queue preview ─────────────────────────────────── */}
        <section aria-labelledby="review-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="review-heading" className="text-base font-semibold text-gray-800">
              Требует проверки
              {reviewCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5 tabular-nums">
                  {reviewCount}
                </span>
              )}
            </h2>
            {reviewCount > 5 && (
              <Link
                href="/review"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
              >
                Смотреть все {reviewCount} →
              </Link>
            )}
          </div>

          {reviewCount === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-8 text-center">
              <p className="text-sm text-gray-500">Очередь пуста — нет элементов для проверки</p>
            </div>
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100" role="list">
              {topReviews.map((item) => (
                <li key={item.companyId}>
                  <Link
                    href={`/lead/${item.companyId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      {item.city && (
                        <p className="text-xs text-gray-400">{item.city}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.lead_branch && <BranchBadge branch={item.lead_branch} />}
                      {item.credit_risk && <CreditBadge risk={item.credit_risk} />}
                      <ReviewReasonBadge reason={item.reason} />
                    </div>
                  </Link>
                </li>
              ))}
              {reviewCount > 5 && (
                <li className="px-4 py-3 text-center">
                  <Link
                    href="/review"
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
                  >
                    Ещё {reviewCount - 5} элементов →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* ── Base stats (secondary) ──────────────────────────────── */}
        <section aria-labelledby="base-stats-heading">
          <h2 id="base-stats-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            База (справочно)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Компаний"
              value={formatNumber(stats.totalCompanies)}
            />
            <StatCard
              label="Обогащено"
              value={formatNumber(stats.enrichedCount)}
              sub={`${stats.enrichedPercent}% от всех`}
              accent="blue"
            />
            <StatCard
              label="Лиды всего"
              value={formatNumber(stats.leadsTotal)}
              accent="green"
            />
            <StatCard
              label="A · Есть сайт"
              value={formatNumber(stats.leadsABadSite)}
              accent="blue"
            />
            <StatCard
              label="B · Без сайта"
              value={formatNumber(stats.leadsBNoSite)}
              accent="default"
            />
          </div>
        </section>

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FunnelCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'default' | 'green' | 'amber' | 'blue';
}) {
  const valueColor =
    accent === 'green'
      ? 'text-green-700'
      : accent === 'amber'
      ? 'text-amber-700'
      : accent === 'blue'
      ? 'text-blue-700'
      : 'text-brand-700';

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {formatNumber(value)}
      </div>
      <div className="mt-0.5 text-xs font-medium text-gray-600 leading-tight">{label}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    sent: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    no_response: 'bg-gray-100 text-gray-600',
    lost: 'bg-red-100 text-red-800',
    won: 'bg-green-100 text-green-800',
  };
  const labels: Record<string, string> = {
    sent: 'В работе',
    in_progress: 'Ответил',
    no_response: 'Игнор',
    lost: 'Отказ',
    won: 'Сделка',
  };
  const cls = map[outcome] ?? 'bg-gray-100 text-gray-600';
  const label = labels[outcome] ?? outcome;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ReviewReasonBadge({ reason }: { reason: 'needs_review' | 'audit_ready' }) {
  if (reason === 'audit_ready') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Аудит готов
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Ручная проверка
    </span>
  );
}

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
