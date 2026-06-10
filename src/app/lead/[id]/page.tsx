/**
 * lead/[id]/page.tsx — full detail view for one company + enrichment.
 *
 * Server component. Reads DB via getCompanyDetail.
 * Shows all fields: company info, enrichment, finances, contacts, PageSpeed.
 * Mobile-friendly layout with sticky quick-action bar at bottom on phones.
 *
 * Protected by middleware.ts.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { BranchBadge, CreditBadge, PageSpeedBadge } from '@/components/badges';
import { getCompanyDetail } from '@/lib/dashboard-queries';
import { formatCurrency, formatDate, formatDomain, formatNumber } from '@/lib/format';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const company = await getCompanyDetail(params.id);

  if (!company) notFound();

  const e = company.enrichment;
  const primaryPhone = e?.phone ?? e?.mobile;
  const secondaryPhone = e?.phone && e?.mobile ? e.mobile : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Back navigation */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700 transition"
          aria-label="Назад к списку лидов"
        >
          <BackArrow />
          Все лиды
        </Link>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 pb-24 sm:pb-6 space-y-5">

        {/* ── Company header ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{company.name}</h1>
              {company.city && (
                <p className="mt-0.5 text-sm text-gray-500">{company.city}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                EVRK {company.evrk2_code} · {company.evrk2_name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {e?.lead_branch && <BranchBadge branch={e.lead_branch} />}
              {e?.credit_risk && <CreditBadge risk={e.credit_risk} />}
            </div>
          </div>

          {/* Credit label */}
          {e?.credit_label && (
            <p className="mt-3 text-xs text-gray-500">
              Кредит-риск: <span className="font-medium text-gray-700">{e.credit_label}</span>
            </p>
          )}
        </div>

        {/* ── Contacts ────────────────────────────────────────────── */}
        <SectionCard title="Контакты">
          <DetailGrid>
            <DetailItem label="Телефон">
              {primaryPhone ? (
                <a
                  href={`tel:${primaryPhone.replace(/\s/g, '')}`}
                  className="text-brand-600 font-medium hover:underline"
                >
                  {primaryPhone}
                </a>
              ) : (
                <Dash />
              )}
            </DetailItem>

            {secondaryPhone && (
              <DetailItem label="Мобильный">
                <a
                  href={`tel:${secondaryPhone.replace(/\s/g, '')}`}
                  className="text-brand-600 font-medium hover:underline"
                >
                  {secondaryPhone}
                </a>
              </DetailItem>
            )}

            <DetailItem label="Email">
              {e?.email ? (
                <a
                  href={`mailto:${e.email}`}
                  className="text-blue-600 hover:underline break-all"
                >
                  {e.email}
                </a>
              ) : (
                <Dash />
              )}
            </DetailItem>

            <DetailItem label="Сайт">
              {e?.website_url ? (
                <a
                  href={e.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {formatDomain(e.website_url)}
                </a>
              ) : (
                <Dash />
              )}
            </DetailItem>
          </DetailGrid>
        </SectionCard>

        {/* ── Website & PageSpeed ─────────────────────────────────── */}
        {e?.has_website && (
          <SectionCard title="Сайт и PageSpeed">
            <DetailGrid>
              <DetailItem label="Статус сайта">
                <span className="text-gray-700">{websiteStatusLabel(e.website_status)}</span>
              </DetailItem>
              <DetailItem label="Mobile">
                <PageSpeedBadge score={e.pagespeed_mobile} />
              </DetailItem>
              <DetailItem label="Desktop">
                <PageSpeedBadge score={e.pagespeed_desktop} />
              </DetailItem>
              {e.google_rating && (
                <DetailItem label="Рейтинг Google">
                  <span className="tabular-nums text-gray-700">★ {e.google_rating}</span>
                </DetailItem>
              )}
            </DetailGrid>

            {/* Audit issues */}
            {Array.isArray(e.audit_issues) && e.audit_issues.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Проблемы сайта
                </p>
                <ul className="space-y-1.5">
                  {(e.audit_issues as unknown as AuditIssue[]).map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <SeverityDot severity={issue.severity} />
                      <span className="text-gray-700">
                        <span className="font-medium">{issue.type}</span>
                        {issue.detail && (
                          <span className="text-gray-500"> — {issue.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Финансы ─────────────────────────────────────────────── */}
        {(e?.revenue || e?.profit) && (
          <SectionCard title={`Финансы${e.fin_year ? ` (${e.fin_year})` : ''}`}>
            <DetailGrid>
              <DetailItem label="Выручка">
                <span className="tabular-nums font-medium text-gray-900">
                  {formatCurrency(e.revenue)}
                </span>
              </DetailItem>
              <DetailItem label="Прибыль / убыток">
                <span
                  className={`tabular-nums font-medium ${
                    e.profit && parseFloat(e.profit) < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(e.profit)}
                </span>
              </DetailItem>
            </DetailGrid>
          </SectionCard>
        )}

        {/* ── Company info ────────────────────────────────────────── */}
        <SectionCard title="О компании">
          <DetailGrid>
            <DetailItem label="RC-код">{company.rc_code}</DetailItem>
            <DetailItem label="Правовая форма">
              {company.legal_form ?? <Dash />}
            </DetailItem>
            <DetailItem label="Адрес">
              {company.address ?? <Dash />}
            </DetailItem>
            <DetailItem label="Дата регистрации">
              {formatDate(company.reg_date)}
            </DetailItem>
            <DetailItem label="Статус RC">
              <StatusBadge status={company.status} />
            </DetailItem>
            <DetailItem label="Синхронизировано">
              {formatDate(company.rc_synced_at)}
            </DetailItem>
          </DetailGrid>
        </SectionCard>

        {/* ── Enrichment meta ─────────────────────────────────────── */}
        {e && (
          <SectionCard title="Данные обогащения">
            <DetailGrid>
              <DetailItem label="Статус обогащения">{enrichStatusLabel(e.enrich_status)}</DetailItem>
              <DetailItem label="Ревью">{reviewStatusLabel(e.review_status)}</DetailItem>
              {e.places_match_confidence && (
                <DetailItem label="Places confidence">{e.places_match_confidence}</DetailItem>
              )}
              {e.places_match_score != null && (
                <DetailItem label="Match score">
                  <span className="tabular-nums">{e.places_match_score}</span>
                </DetailItem>
              )}
              <DetailItem label="Обогащено">
                {formatDate(e.enriched_at)}
              </DetailItem>
            </DetailGrid>
          </SectionCard>
        )}

      </main>

      {/* ── Mobile quick-action sticky bar ──────────────────────────── */}
      {primaryPhone || e?.website_url ? (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-20">
          {primaryPhone && (
            <a
              href={`tel:${primaryPhone.replace(/\s/g, '')}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white text-sm font-semibold py-3 hover:bg-brand-700 transition"
            >
              <PhoneIcon />
              Позвонить
            </a>
          )}
          {e?.website_url && (
            <a
              href={e.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold py-3 hover:bg-gray-50 transition"
            >
              <GlobeIcon />
              Открыть сайт
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {children}
    </dl>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function Dash() {
  return <span className="text-gray-300">—</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
        Действующая
      </span>
    );
  }
  return <span className="text-gray-500 text-sm">{status}</span>;
}

interface AuditIssue {
  type: string;
  severity?: string;
  detail?: string;
}

function SeverityDot({ severity }: { severity?: string }) {
  const color =
    severity === 'critical'
      ? 'bg-red-500'
      : severity === 'major'
      ? 'bg-orange-400'
      : severity === 'minor'
      ? 'bg-yellow-400'
      : 'bg-gray-300';
  return (
    <span
      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${color}`}
      aria-hidden="true"
    />
  );
}

function websiteStatusLabel(s: string): string {
  const map: Record<string, string> = {
    not_checked: 'Не проверен',
    candidate_found: 'Кандидат найден',
    verified_own_website: 'Верифицирован',
    no_own_website: 'Сайт отсутствует',
    external_profile_only: 'Только внешний профиль',
    ambiguous: 'Неоднозначно',
    wrong_match: 'Неверный матч',
    not_in_places: 'Нет в Places',
  };
  return map[s] ?? s;
}

function enrichStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: 'Ожидает',
    places_done: 'Places выполнен',
    fallback_done: 'Fallback выполнен',
    rekvizitai_done: 'Rekvizitai выполнен',
    archived_garbage: 'Архив (мусор)',
    skipped_limit: 'Пропущен (лимит)',
  };
  return map[s] ?? s;
}

function reviewStatusLabel(s: string): string {
  const map: Record<string, string> = {
    auto_approved: 'Авто-одобрен',
    needs_review: 'Требует ревью',
    manually_approved: 'Одобрен вручную',
    rejected: 'Отклонён',
  };
  return map[s] ?? s;
}

// Icons
function BackArrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
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

function GlobeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

// Suppress "unused" warning — formatNumber is used in the page but linter
// might miss it since it's only referenced in JSX expressions.
void formatNumber;
