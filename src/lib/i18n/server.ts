/**
 * server.ts — доступ к локали на сервере (читает cookie `locale`).
 * Используют серверные компоненты и layout. Вызов cookies() делает их динамическими.
 */
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { getDictionary, type Dictionary } from './dictionaries';

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export function getDict(): Dictionary {
  return getDictionary(getLocale());
}
