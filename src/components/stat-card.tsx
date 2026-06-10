/**
 * stat-card.tsx — summary stat card for the dashboard header.
 *
 * Server component (no interactivity needed).
 */

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'default' | 'green' | 'amber' | 'blue';
}

export function StatCard({ label, value, sub, accent = 'default' }: StatCardProps) {
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
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-700">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
