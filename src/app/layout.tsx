import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leadgen LT',
  description: 'Lithuanian B2B Lead Generation Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
