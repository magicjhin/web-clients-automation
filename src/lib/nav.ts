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

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  status?: 'soon';
  /** Точное совпадение пути (для главной), иначе — startsWith. */
  exact?: boolean;
}

export const navItems: NavItem[] = [
  { label: 'Обзор', href: '/', icon: LayoutDashboard, exact: true },
  { label: 'Лиды', href: '/leads', icon: Users },
  { label: 'Проверка', href: '/review', icon: ClipboardCheck },
  { label: 'База', href: '/base', icon: Database },
  { label: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { label: 'Письма', href: '/outreach', icon: Mail, status: 'soon' },
  { label: 'CRM', href: '/crm', icon: KanbanSquare, status: 'soon' },
  { label: 'Настройки', href: '/settings', icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  // /leads активен на /leads, но НЕ на /leads/[id]? Карточка лида — это деталь
  // лида, оставляем подсветку на «Лиды». /base тоже линкует на /leads/[id].
  return pathname === item.href || pathname.startsWith(item.href + '/');
}
