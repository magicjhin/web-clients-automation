'use client';

/**
 * badges.tsx — статус-плашки для лидов.
 *
 * SiteBadge: A_bad_site = «Есть сайт» (НЕ «плохой» — аудит/PageSpeed не делали),
 *            B_no_site = «Нет сайта».
 * CreditBadge: A/B/C — кредит-риск.
 * ReviewBadge: статус ревью (очередь).
 * PageSpeedBadge: оценка PageSpeed (когда появится).
 */
import { Globe, GlobeLock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/provider';

export function SiteBadge({ branch }: { branch: string }) {
  const { dict } = useI18n();
  if (branch === 'A_bad_site') {
    return (
      <Badge variant="neutral" className="gap-1">
        <Globe className="h-3 w-3" />
        {dict.badges.hasSite}
      </Badge>
    );
  }
  if (branch === 'B_no_site') {
    return (
      <Badge variant="brand" className="gap-1">
        <GlobeLock className="h-3 w-3" />
        {dict.badges.noSite}
      </Badge>
    );
  }
  return <Badge variant="outline">{branch}</Badge>;
}

export function CreditBadge({ risk }: { risk: string | null }) {
  const { dict } = useI18n();
  const labels: Record<string, string> = {
    A: dict.badges.creditA,
    B: dict.badges.creditB,
    C: dict.badges.creditC,
    D: dict.badges.creditD,
    E: dict.badges.creditE,
  };
  const variant =
    risk === 'A'
      ? 'success'
      : risk === 'B'
        ? 'secondary'
        : risk === 'C'
          ? 'warning'
          : risk === 'D' || risk === 'E'
            ? 'destructive'
            : 'outline';
  return (
    <Badge variant={variant} title={risk ? labels[risk] : undefined}>
      {risk ?? '—'}
    </Badge>
  );
}

export function ReviewBadge({ status }: { status: string }) {
  const { dict } = useI18n();
  const map: Record<string, { label: string; variant: 'warning' | 'success' | 'neutral' | 'destructive' }> = {
    needs_review: { label: dict.badges.reviewNeeds, variant: 'warning' },
    auto_approved: { label: dict.badges.reviewAuto, variant: 'success' },
    manually_approved: { label: dict.badges.reviewManual, variant: 'success' },
    rejected: { label: dict.badges.reviewRejected, variant: 'destructive' },
  };
  const cfg = map[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PageSpeedBadge({ score, label }: { score: number | null; label?: string }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const variant = score >= 90 ? 'success' : score >= 50 ? 'warning' : 'destructive';
  return (
    <Badge variant={variant}>
      {label ? `${label} ${score}` : score}
    </Badge>
  );
}
