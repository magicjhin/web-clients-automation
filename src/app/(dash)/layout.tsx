import { AppSidebar } from '@/components/app-sidebar';
import { Topbar } from '@/components/topbar';
import { I18nProvider } from '@/lib/i18n/provider';
import { getDict, getLocale } from '@/lib/i18n/server';

/**
 * Каркас кабинета: тёмный sidebar (десктоп) + контентная область с топбаром.
 * Защищён middleware.ts (пароль-гейт). URL не меняется — route group.
 * I18nProvider раздаёт локаль и словарь клиентским компонентам кабинета.
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const dict = getDict();
  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
