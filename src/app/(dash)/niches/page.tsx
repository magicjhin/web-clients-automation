/**
 * Ниши — EVRK-разделы по числу лидов + раскладка есть/нет сайта.
 */
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getNicheStats } from '@/lib/dashboard-queries';
import { formatNumber, evrkName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NichesPage() {
  const niches = await getNicheStats(30);
  const max = Math.max(1, ...niches.map((n) => n.leads));

  return (
    <>
      <PageHeader
        title="Ниши"
        subtitle="Разделы EVRK по числу лидов (кредит-риск A/B/C)"
      />

      <Card className="p-0">
        <CardContent className="divide-y p-0">
          {niches.map((n) => (
            <Link
              key={n.code2}
              href={`/leads?niche=${n.code2}`}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
            >
              <span className="tabular w-8 shrink-0 text-sm font-semibold text-muted-foreground">
                {n.code2}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{evrkName(n.code2)}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(n.leads / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-sm font-semibold">{formatNumber(n.leads)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(n.withSite)} с сайтом · {formatNumber(n.noSite)} без
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
