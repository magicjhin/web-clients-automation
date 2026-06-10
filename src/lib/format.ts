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

/**
 * Ensure an external URL has a scheme, so the browser doesn't treat it as a
 * relative path (e.g. "example.lt" → "https://example.lt", иначе открывается
 * наш_домен/example.lt). Returns null for empty input.
 */
export function externalHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed.replace(/^\/+/, '');
}

/** Человекочитаемое название раздела EVRK по 2-значному коду. */
const EVRK_SECTIONS: Record<string, string> = {
  '41': 'Строительство зданий',
  '42': 'Гражданское строительство',
  '43': 'Спецстройработы',
  '45': 'Авто: торговля и ремонт',
  '46': 'Оптовая торговля',
  '47': 'Розничная торговля',
  '49': 'Транспорт',
  '55': 'Гостиницы',
  '56': 'Общепит',
  '62': 'IT и ПО',
  '63': 'Инфоуслуги',
  '64': 'Финансы',
  '68': 'Недвижимость',
  '69': 'Юр. и бухучёт',
  '70': 'Консалтинг',
  '71': 'Архитектура и инжиниринг',
  '73': 'Реклама',
  '74': 'Проф. деятельность',
  '77': 'Аренда',
  '79': 'Турагентства',
  '81': 'Обслуживание зданий',
  '85': 'Образование',
  '86': 'Здравоохранение',
  '90': 'Искусство',
  '93': 'Спорт и отдых',
  '95': 'Ремонт',
  '96': 'Бытовые услуги',
};

export function evrkName(code2: string | null | undefined): string {
  if (!code2) return '—';
  return EVRK_SECTIONS[code2] ?? `EVRK ${code2}`;
}

/** Truncate a URL to show just the hostname. */
export function formatDomain(url: string | null | undefined): string {
  if (!url) return '—';
  const href = externalHref(url);
  try {
    return new URL(href as string).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
