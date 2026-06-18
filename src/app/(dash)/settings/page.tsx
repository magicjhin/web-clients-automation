/**
 * Настройки — профиль, тариф, рассылка, безопасность.
 * Редактируемые части подключатся вместе с Auth/онбордингом/биллингом.
 */
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDict } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const dict = getDict();
  const s = dict.settings;
  const tier4 = [s.feature1, s.feature2, s.feature3, s.feature4];
  return (
    <>
      <PageHeader title={s.title} subtitle={s.subtitle} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{s.profile}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={s.subscriber} value="Webvibe" />
            <Row label={s.email} value="aleksandr.kuc93@gmail.com" />
            <Row label={s.region} value={s.regionValue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">{s.tier}</CardTitle>
            <Badge variant="default">{s.tierBadge}</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {tier4.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-600" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">{s.mailing}</CardTitle>
            <Badge variant="brand">{dict.common.soon}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{s.mailingNote}</p>
            <Row label={s.resendDomain} value="—" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">{s.security}</CardTitle>
            <Badge variant="brand">{dict.common.soon}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{s.securityNote}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
