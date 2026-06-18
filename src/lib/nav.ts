/**
 * nav.ts — единый конфиг навигации кабинета (sidebar + мобильное меню).
 * status: 'soon' — раздел-заглушка (бэкенд ещё не готов).
 *
 * Структура «пульта» Tier 4:
 * - Обзор   — пульт (напоминания + аналитика + сегодняшние лиды)
 * - Лиды    — ТОЛЬКО выданные нам (рабочий набор на обработку, с комментариями)
 * - Проверка— ревью сгенерированных аудита+письма (ждут подтверждения)
 * - База    — ВСЯ база A/B/C + выбор по нише + срез
 * - Аналитика — результативность работы
 */
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Database,
  BarChart3,
  Mail,
  KanbanSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/** Ключ подписи пункта в словаре (dict.nav[key]) — перевод берётся по нему. */
export type NavKey = keyof Dictionary['nav'];

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  status?: 'soon';
  /** Точное совпадение пути (для главной), иначе — startsWith. */
  exact?: boolean;
}

export const navItems: NavItem[] = [
  { key: 'overview', href: '/', icon: LayoutDashboard, exact: true },
  { key: 'leads', href: '/leads', icon: Users },
  { key: 'review', href: '/review', icon: ClipboardCheck },
  { key: 'base', href: '/base', icon: Database },
  { key: 'analytics', href: '/analytics', icon: BarChart3 },
  { key: 'outreach', href: '/outreach', icon: Mail, status: 'soon' },
  { key: 'crm', href: '/crm', icon: KanbanSquare, status: 'soon' },
  { key: 'settings', href: '/settings', icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  // /leads активен на /leads, но НЕ на /leads/[id]? Карточка лида — это деталь
  // лида, оставляем подсветку на «Лиды». /base тоже линкует на /leads/[id].
  return pathname === item.href || pathname.startsWith(item.href + '/');
}
