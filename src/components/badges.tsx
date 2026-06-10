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

export function SiteBadge({ branch }: { branch: string }) {
  if (branch === 'A_bad_site') {
    return (
      <Badge variant="neutral" className="gap-1">
        <Globe className="h-3 w-3" />
        Есть сайт
      </Badge>
    );
  }
  if (branch === 'B_no_site') {
    return (
      <Badge variant="brand" className="gap-1">
        <GlobeLock className="h-3 w-3" />
        Нет сайта
      </Badge>
    );
  }
  return <Badge variant="outline">{branch}</Badge>;
}

const CREDIT_LABEL: Record<string, string> = {
  A: 'минимальный риск',
  B: 'низкий риск',
  C: 'средний риск',
};

export function CreditBadge({ risk }: { risk: string | null }) {
  const variant =
    risk === 'A' ? 'success' : risk === 'B' ? 'secondary' : risk === 'C' ? 'warning' : 'outline';
  return (
    <Badge variant={variant} title={risk ? CREDIT_LABEL[risk] : undefined}>
      {risk ?? '—'}
    </Badge>
  );
}

const REVIEW: Record<string, { label: string; variant: 'warning' | 'success' | 'neutral' | 'destructive' }> = {
  needs_review: { label: 'Ждёт проверки', variant: 'warning' },
  auto_approved: { label: 'Авто-одобрен', variant: 'success' },
  manually_approved: { label: 'Одобрен', variant: 'success' },
  rejected: { label: 'Отклонён', variant: 'destructive' },
};

export function ReviewBadge({ status }: { status: string }) {
  const cfg = REVIEW[status] ?? { label: status, variant: 'neutral' as const };
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
