'use client';

import Link from 'next/link';
import { Phone, ExternalLink, Inbox } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SiteBadge, CreditBadge } from '@/components/badges';
import { formatCurrency, formatDomain, externalHref } from '@/lib/format';
import type { LeadRow } from '@/lib/dashboard-queries';
import { useI18n } from '@/lib/i18n/provider';

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const { dict } = useI18n();
  const t = dict.table;
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
          <Inbox className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium">{t.notFound}</p>
        <p className="text-sm text-muted-foreground">{t.tryFilters}</p>
      </div>
    );
  }

  const phoneOf = (l: LeadRow) => l.phone ?? l.mobile;

  return (
    <>
      {/* Мобильные карточки (< lg) */}
      <ul className="divide-y lg:hidden" role="list">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link
              href={`/leads/${lead.id}`}
              className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{lead.name}</p>
                  {lead.city && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{lead.city}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <CreditBadge risk={lead.credit_risk} />
                  <SiteBadge branch={lead.lead_branch} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="tabular font-medium">{formatCurrency(lead.revenue)}</span>
                <div className="flex items-center gap-3">
                  {phoneOf(lead) && (
                    <a
                      href={`tel:${phoneOf(lead)!.replace(/\s/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 font-medium text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {phoneOf(lead)}
                    </a>
                  )}
                  {lead.website_url && (
                    <span className="max-w-[120px] truncate text-brand-700">
                      {formatDomain(lead.website_url)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Десктоп-таблица (lg+) */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t.company}</TableHead>
              <TableHead>{t.site}</TableHead>
              <TableHead>{t.risk}</TableHead>
              <TableHead className="text-right">{t.revenue}</TableHead>
              <TableHead>{t.phone}</TableHead>
              <TableHead>{t.siteEmail}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="group">
                <TableCell>
                  <Link href={`/leads/${lead.id}`} className="block">
                    <span className="font-medium group-hover:underline">{lead.name}</span>
                    {lead.city && (
                      <span className="block text-xs text-muted-foreground">{lead.city}</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <SiteBadge branch={lead.lead_branch} />
                </TableCell>
                <TableCell>
                  <CreditBadge risk={lead.credit_risk} />
                </TableCell>
                <TableCell className="tabular text-right font-medium">
                  {formatCurrency(lead.revenue)}
                </TableCell>
                <TableCell>
                  {phoneOf(lead) ? (
                    <a
                      href={`tel:${phoneOf(lead)!.replace(/\s/g, '')}`}
                      className="whitespace-nowrap hover:text-brand-700"
                    >
                      {phoneOf(lead)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {lead.website_url ? (
                    <a
                      href={externalHref(lead.website_url) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[180px] items-center gap-1 truncate text-brand-700 hover:underline"
                    >
                      {formatDomain(lead.website_url)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : lead.email ? (
                    <a href={`mailto:${lead.email}`} className="truncate text-brand-700 hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
