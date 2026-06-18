import type { Metadata } from 'next';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/lib/i18n/provider';
import { getDict, getLocale } from '@/lib/i18n/server';

export function generateMetadata(): Metadata {
  return {
    title: 'leads.webvibe',
    description: getDict().login.tagline,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getLocale();
  const dict = getDict();
  return (
    <html lang={locale}>
      <body className="antialiased">
        <I18nProvider locale={locale} dict={dict}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
