/**
 * dictionaries.ts — реестр словарей и тип Dictionary.
 * ru — источник истины по структуре; lt/en типизируются под него.
 * Серверно-безопасно (без next/headers) — можно импортировать с клиента.
 */
import type { Locale } from './config';
import { ru } from './dictionaries/ru';
import { lt } from './dictionaries/lt';
import { en } from './dictionaries/en';

export type Dictionary = typeof ru;

const dictionaries: Record<Locale, Dictionary> = { ru, lt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
