/**
 * i18n/config.ts — конфиг локализации кабинета.
 * Лёгкий кастомный i18n: выбор языка хранится в cookie `locale`, URL не меняется.
 * Языки: ru (по умолчанию, рабочий), lt (литовский), en (английский).
 * Серверно-безопасный модуль (без next/headers) — импортируется и на клиенте.
 */
export const locales = ['ru', 'lt', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';

/** Имя cookie с выбранным языком (1 год, path=/). Middleware его игнорирует. */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

/** Подписи языков в переключателе (на родном языке каждого). */
export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  lt: 'Lietuvių',
  en: 'English',
};

/** Короткий код для бейджа в переключателе. */
export const localeShort: Record<Locale, string> = {
  ru: 'RU',
  lt: 'LT',
  en: 'EN',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * Подстановка переменных в строку словаря: fmt('{count} в работе', { count: 5 }).
 * Чистая функция — безопасна и на сервере, и на клиенте.
 */
export function fmt(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}
