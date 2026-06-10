import Link from 'next/link';
import { Phone } from 'lucide-react';
import { CreditBadge, SiteBadge } from '@/components/badges';
import { LeadActionButton } from '@/components/lead-action-button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, evrkName } from '@/lib/format';
import type { LeadRow } from '@/lib/dashboard-queries';

/**
 * Список выданных лидов (рабочий набор). По каждому — статус обработки + кнопка «Обработать».
 * UI-first: пока «статус» у всех «Не обработан» (генерации ещё нет).
 */
export function TodayLeads({ leads }: { leads: LeadRow[] }) {
  if (leads.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        На сегодня лидов нет.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {leads.map((lead) => {
        const phone = lead.phone ?? lead.mobile;
        return (
          <li
            key={lead.id}
            className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/leads/${lead.id}`} className="truncate text-sm font-medium hover:underline">
                  {lead.name}
                </Link>
                <Badge variant="outline" className="shrink-0 text-muted-foreground">
                  Не обработан
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {evrkName(lead.evrk2_code.slice(0, 2))} · {lead.city ?? '—'} · {formatCurrency(lead.revenue)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CreditBadge risk={lead.credit_risk} />
              <SiteBadge branch={lead.lead_branch} />
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-secondary hover:bg-accent"
                  aria-label={`Позвонить ${lead.name}`}
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
              <LeadActionButton companyName={lead.name} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
