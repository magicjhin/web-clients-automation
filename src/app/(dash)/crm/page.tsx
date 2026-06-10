import { KanbanSquare } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ComingSoon } from '@/components/coming-soon';

export default function CrmPage() {
  return (
    <>
      <PageHeader title="CRM" subtitle="Тариф «Максимум» — сделки под ключ" />
      <ComingSoon
        icon={KanbanSquare}
        title="CRM-пайплайн"
        description="Лид → сделка → коммерческое предложение → договор → счёт. Канбан-доска и история по каждому контакту."
        bullets={[
          'Канбан по стадиям сделки',
          'КП, договоры и счета из карточки',
          'История касаний и задач',
        ]}
      />
    </>
  );
}
