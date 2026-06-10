import { AppSidebar } from '@/components/app-sidebar';
import { Topbar } from '@/components/topbar';

/**
 * Каркас кабинета: тёмный sidebar (десктоп) + контентная область с топбаром.
 * Защищён middleware.ts (пароль-гейт). URL не меняется — route group.
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
