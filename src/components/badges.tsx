/**
 * badges.tsx — Lead branch and credit risk badges for the dashboard.
 *
 * BranchBadge: A_bad_site = "Есть сайт" (НЕ «плохой» — аудит/PageSpeed ещё не делали,
 *              можем утверждать только факт наличия сайта), B_no_site = "Нет сайта"
 * CreditBadge: A = green, B = teal, C = amber
 */

// No "use client" — these are pure presentational components, usable in RSC.

interface BranchBadgeProps {
  branch: 'A_bad_site' | 'B_no_site' | string;
}

export function BranchBadge({ branch }: BranchBadgeProps) {
  if (branch === 'A_bad_site') {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        Есть сайт
      </span>
    );
  }
  if (branch === 'B_no_site') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        B · Нет сайта
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {branch}
    </span>
  );
}

interface CreditBadgeProps {
  risk: 'A' | 'B' | 'C' | string | null;
}

export function CreditBadge({ risk }: CreditBadgeProps) {
  if (risk === 'A') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        A
      </span>
    );
  }
  if (risk === 'B') {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
        B
      </span>
    );
  }
  if (risk === 'C') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        C
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      {risk ?? '—'}
    </span>
  );
}

interface PageSpeedBadgeProps {
  score: number | null;
  label?: string;
}

export function PageSpeedBadge({ score, label }: PageSpeedBadgeProps) {
  if (score == null) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  const colorClass =
    score >= 90
      ? 'bg-green-100 text-green-800'
      : score >= 50
      ? 'bg-amber-100 text-amber-800'
      : 'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label ? `${label} ${score}` : score}
    </span>
  );
}
