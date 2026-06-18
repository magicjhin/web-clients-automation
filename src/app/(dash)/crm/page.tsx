import { KanbanSquare } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ComingSoon } from '@/components/coming-soon';
import { getDict } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default function CrmPage() {
  const c = getDict().crm;
  return (
    <>
      <PageHeader title={c.headerTitle} subtitle={c.headerSubtitle} />
      <ComingSoon
        icon={KanbanSquare}
        title={c.title}
        description={c.description}
        bullets={[c.bullet1, c.bullet2, c.bullet3]}
      />
    </>
  );
}
