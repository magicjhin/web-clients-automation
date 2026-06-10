/**
 * Настройки — профиль, тариф, рассылка, безопасность.
 * Редактируемые части подключатся вместе с Auth/онбордингом/биллингом.
 */
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TIER4 = [
  'Лиды + статус сайта',
  'Аудит сайта (PageSpeed)',
  'Письмо + отправка (Resend)',
  'CRM: лид → сделка → КП → договор → счёт',
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Настройки" subtitle="Профиль и параметры подписки" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Профиль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Подписчик" value="Webvibe" />
            <Row label="Email" value="aleksandr.kuc93@gmail.com" />
            <Row label="Регион" value="Литва" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">Тариф</CardTitle>
            <Badge variant="default">Tier 4 · Максимум</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {TIER4.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-lime-600" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">Рассылка</CardTitle>
            <Badge variant="brand">скоро</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Подключение Resend-домена и верификация — на этапе онбординга.</p>
            <Row label="Resend-домен" value="—" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between">
            <CardTitle className="text-base">Безопасность</CardTitle>
            <Badge variant="brand">скоро</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Сейчас вход по паролю-гейту. Полноценные аккаунты (Auth.js, 2FA /
              Google) заменят его в фазе подписок.
            </p>
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
