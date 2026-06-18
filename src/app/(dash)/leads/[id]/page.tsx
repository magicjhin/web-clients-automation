/**
 * Карточка лида: реквизиты, контакты, финансы, кредит-риск, статус сайта.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Smartphone,
  Mail,
  Globe,
  MapPin,
  Building2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditBadge, SiteBadge, PageSpeedBadge } from '@/components/badges';
import { LeadActionButton } from '@/components/lead-action-button';
import { LeadNotes } from '@/components/lead-notes';
import { LeadStatus } from '@/components/lead-status';
import { getCompanyDetail } from '@/lib/dashboard-queries';
import {
  formatCurrency,
  formatDate,
  formatDomain,
  externalHref,
  evrkName,
} from '@/lib/format';
import { getDict } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const company = await getCompanyDetail(params.id);
  if (!company) notFound();

  const e = company.enrichment;
  const phone = e?.phone ?? null;
  const dict = getDict();
  const d = dict.leadDetail;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/leads">
          <ArrowLeft className="h-4 w-4" />
          {d.backToList}
        </Link>
      </Button>

      <PageHeader
        title={company.name}
        subtitle={`${evrkName(company.evrk2_code.slice(0, 2), dict.evrk)} · EVRK ${company.evrk2_code}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {e?.credit_risk && <CreditBadge risk={e.credit_risk} />}
            {e?.lead_branch && <SiteBadge branch={e.lead_branch} />}
          </div>
        }
      />

      {/* Обработка */}
      <Card className="mb-4">
        <CardHeader className="!flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {d.processing}
          </CardTitle>
          <LeadStatus />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {e?.lead_branch === 'B_no_site' ? (
              <>
                {phone ? (
                  <Button asChild size="default">
                    <a href={`tel:${phone.replace(/\s/g, '')}`}>
                      <Phone className="h-4 w-4" />
                      {dict.cockpit.call}
                    </a>
                  </Button>
                ) : (
                  <Button size="default" variant="outline" disabled>
                    {dict.cockpit.noPhone}
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {d.noSiteNote}
                </span>
              </>
            ) : (
              <>
                <LeadActionButton companyName={company.name} size="default" />
                <span className="text-sm text-muted-foreground">
                  {d.auditEmailNote}
                </span>
              </>
            )}
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {d.commentTitle}
            </p>
            <LeadNotes />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Контакты */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.contacts}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={Phone} label={d.phone}>
              {phone ? (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
                  {phone}
                </a>
              ) : (
                <Muted />
              )}
            </Row>
            <Row icon={Smartphone} label={d.mobile}>
              {e?.mobile ? (
                <a href={`tel:${e.mobile.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
                  {e.mobile}
                </a>
              ) : (
                <Muted />
              )}
            </Row>
            <Row icon={Mail} label={d.email}>
              {e?.email ? (
                <a href={`mailto:${e.email}`} className="break-all text-brand-700 hover:underline">
                  {e.email}
                </a>
              ) : (
                <Muted />
              )}
            </Row>
            <Row icon={Globe} label={d.site}>
              {e?.website_url ? (
                <a
                  href={externalHref(e.website_url) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                >
                  {formatDomain(e.website_url)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <Muted />
              )}
            </Row>
            <Separator />
            <Row icon={MapPin} label={d.address}>
              {company.address || company.city || <Muted />}
            </Row>
            <Row icon={Building2} label={d.legalForm}>
              {company.legal_form ?? <Muted />}
            </Row>
          </CardContent>
        </Card>

        {/* Финансы */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.finance}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV label={d.revenue} value={formatCurrency(e?.revenue)} big />
            <KV label={d.profit} value={formatCurrency(e?.profit)} />
            <KV label={d.finYear} value={e?.fin_year ? String(e.fin_year) : '—'} />
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{d.creditRisk}</span>
              <span className="flex items-center gap-2">
                {e?.credit_risk ? <CreditBadge risk={e.credit_risk} /> : <Muted />}
                {e?.credit_label && (
                  <span className="text-xs text-muted-foreground">{e.credit_label}</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Сайт / реестр */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.siteRegistry}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{d.pagespeedMobile}</span>
              <PageSpeedBadge score={e?.pagespeed_mobile ?? null} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{d.pagespeedDesktop}</span>
              <PageSpeedBadge score={e?.pagespeed_desktop ?? null} />
            </div>
            <Separator />
            <KV label={d.rcCode} value={company.rc_code} />
            <KV label={d.city} value={company.city ?? '—'} />
            <KV label={d.registration} value={formatDate(company.reg_date)} />
            <KV label={d.enrichedAt} value={formatDate(e?.enriched_at)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function KV({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular font-semibold ${big ? 'text-lg' : ''}`}>{value}</span>
    </div>
  );
}

function Muted() {
  return <span className="text-muted-foreground">—</span>;
}
