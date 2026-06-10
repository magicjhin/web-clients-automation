import { Mail } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ComingSoon } from '@/components/coming-soon';

export default function OutreachPage() {
  return (
    <>
      <PageHeader title="Письма" subtitle="Генерация и отправка писем подписчика" />
      <ComingSoon
        icon={Mail}
        title="Письма и рассылка"
        description="Литовское письмо под каждый лид (GPT-4o), черновик на проверку, отправка через Resend подписчика — с его домена и имени."
        bullets={[
          'Авто-черновик письма по карточке лида',
          'Очередь подтверждения человеком (GDPR)',
          'Отправка через Resend подписчика, статусы доставки',
        ]}
      />
    </>
  );
}
