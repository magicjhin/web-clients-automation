/**
 * Проверка — ревью сгенерированных аудита и письма перед отправкой.
 * Показывает ТОЛЬКО то, что ждёт проверки (GeneratedContent.status='draft'), не все лиды.
 * Подтверждение человеком обязательно (GDPR). Сейчас пусто — генерации ещё нет.
 */
import { ShieldCheck, Gauge, Mail, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getReviewDrafts } from '@/lib/dashboard-queries';
import { formatNumber, formatDate } from '@/lib/format';
import { getDict } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const drafts = await getReviewDrafts();
  const dict = getDict();

  return (
    <>
      <PageHeader
        title={dict.reviewPage.title}
        subtitle={fmt(dict.reviewPage.subtitle, { count: formatNumber(drafts.length) })}
      />

      <Card className="mb-4 border-amber-200 bg-amber-50/60">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-sm text-foreground/80">
            {dict.reviewPage.banner}
          </p>
        </CardContent>
      </Card>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <ClipboardCheck className="h-7 w-7" />
            </span>
            <p className="text-sm font-medium">{dict.reviewPage.emptyTitle}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {dict.reviewPage.emptyDesc}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <CardContent className="divide-y p-0">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(dict.reviewPage.generatedAt, { date: formatDate(d.generatedAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {d.hasAudit && <Badge variant="secondary" className="gap-1"><Gauge className="h-3 w-3" />{dict.reviewPage.audit}</Badge>}
                  {d.hasEmail && <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />{dict.reviewPage.email}</Badge>}
                  <Button size="sm" variant="outline">{dict.reviewPage.inspect}</Button>
                  <Button size="sm">{dict.reviewPage.confirm}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
