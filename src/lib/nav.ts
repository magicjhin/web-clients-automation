/**
 * nav.ts — единый конфиг навигации кабинета.
 * Источник истины для sidebar (десктоп) и мобильного меню.
 * status: 'soon' — раздел-заглушка (бэкенд ещё не готов).
 */
import {
  LayoutDashboard,
  Users,
  Inbox,
  Layers,
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
  { label: 'Очередь', href: '/queue', icon: Inbox },
  { label: 'Ниши', href: '/niches', icon: Layers },
  { label: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { label: 'Письма', href: '/outreach', icon: Mail, status: 'soon' },
  { label: 'CRM', href: '/crm', icon: KanbanSquare, status: 'soon' },
  { label: 'Настройки', href: '/settings', icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}
