/**
 * format.ts — number and string formatting utilities for the dashboard UI.
 *
 * All currency/number formatting uses tabular-nums-friendly patterns.
 * Revenue/profit are stored as Prisma Decimal (serialised as string in JSON).
 */

/** Format a number with space as thousands separator (38 173). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('ru-RU').format(value);
}

/**
 * Format a Decimal-like value (could be string or number from Prisma JSON) as € amount.
 * E.g. 1234567.89 → "€ 1 234 568"
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return (
    '€ ' +
    new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0,
    }).format(num)
  );
}

/** Format a date as DD.MM.YYYY. */
export function formatDate(value: Date | string | null | undefined): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Truncate a URL to show just the hostname. */
export function formatDomain(url: string | null | undefined): string {
  if (!url) return '—';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
