import Link from 'next/link';
import { Phone } from 'lucide-react';
import { CreditBadge, SiteBadge } from '@/components/badges';
import { LeadActionButton } from '@/components/lead-action-button';
import { Button } from '@/components/ui/button';
import { formatCurrency, evrkName } from '@/lib/format';
import type { LeadRow } from '@/lib/dashboard-queries';
import { getDict } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/config';

/**
 * Список выданных лидов. Действие зависит от наличия сайта:
 * - есть сайт (A_bad_site) → «Обработать» (аудит + письмо);
 * - нет сайта (B_no_site) → «Позвонить» (аудит без сайта не делаем).
 */
export function TodayLeads({ leads }: { leads: LeadRow[] }) {
  const dict = getDict();
  if (leads.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {dict.cockpit.noLeadsToday}
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {leads.map((lead) => {
        const phone = lead.phone ?? lead.mobile;
        const noSite = lead.lead_branch === 'B_no_site';
        return (
          <li
            key={lead.id}
            className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <Link href={`/leads/${lead.id}`} className="truncate text-sm font-medium hover:underline">
                {lead.name}
              </Link>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {evrkName(lead.evrk2_code.slice(0, 2), dict.evrk)} · {lead.city ?? '—'} · {formatCurrency(lead.revenue)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CreditBadge risk={lead.credit_risk} />
              <SiteBadge branch={lead.lead_branch} />
              {noSite ? (
                phone ? (
                  <Button asChild size="sm">
                    <a href={`tel:${phone.replace(/\s/g, '')}`}>
                      <Phone className="h-4 w-4" />
                      {dict.cockpit.call}
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    {dict.cockpit.noPhone}
                  </Button>
                )
              ) : (
                <>
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/\s/g, '')}`}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-secondary hover:bg-accent"
                      aria-label={fmt(dict.cockpit.callAria, { name: lead.name })}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <LeadActionButton companyName={lead.name} />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
