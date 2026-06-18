import { Mail } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ComingSoon } from '@/components/coming-soon';
import { getDict } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default function OutreachPage() {
  const o = getDict().outreach;
  return (
    <>
      <PageHeader title={o.headerTitle} subtitle={o.headerSubtitle} />
      <ComingSoon
        icon={Mail}
        title={o.title}
        description={o.description}
        bullets={[o.bullet1, o.bullet2, o.bullet3]}
      />
    </>
  );
}
