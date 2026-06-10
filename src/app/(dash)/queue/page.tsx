/**
 * Очередь — лиды со статусом needs_review. Подтверждение человеком —
 * юридический предохранитель (GDPR). Полный флоу approve/send появится
 * вместе с email-gen (Tier 3).
 */
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { LeadsTable } from '@/components/leads-table';
import { Pagination } from '@/components/pagination';
import { getLeads } from '@/lib/dashboard-queries';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function QueuePage({ searchParams }: PageProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const result = await getLeads({ review_status: 'needs_review', page, pageSize: 25 });

  return (
    <>
      <PageHeader
        title="Очередь проверки"
        subtitle={`${formatNumber(result.total)} лидов ждут подтверждения человеком`}
      />

      <Card className="mb-4 border-amber-200 bg-amber-50/60">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-sm text-foreground/80">
            Подтверждение письма человеком обязательно — это юридический
            предохранитель (GDPR). Кнопки «Проверить / Подтвердить отправку»
            подключатся вместе с генерацией писем (Tier 3).
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <LeadsTable leads={result.leads} />
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
        />
      </Card>
    </>
  );
}
