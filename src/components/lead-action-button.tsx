'use client';

/**
 * lead-action-button.tsx — кнопка «Обработать» (Tier 4).
 * ЦЕЛЬ (одна кнопка): аудит → отчёт по аудиту → письмо с предложением.
 * Сейчас застаблено: бэкенд (audit-gen/email-gen через Claude/PageSpeed) ещё не подключён.
 * Клик открывает окно с описанием цепочки и пометкой «скоро».
 */
import { useState } from 'react';
import { Sparkles, Gauge, FileText, Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/provider';
import { fmt } from '@/lib/i18n/config';

export function LeadActionButton({
  companyName,
  size = 'sm',
}: {
  companyName: string;
  size?: 'sm' | 'default';
}) {
  const [open, setOpen] = useState(false);
  const { dict } = useI18n();
  const steps = [
    { icon: Gauge, label: dict.leadAction.step1 },
    { icon: FileText, label: dict.leadAction.step2 },
    { icon: Mail, label: dict.leadAction.step3 },
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Sparkles className="h-4 w-4" />
          {dict.leadAction.process}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dict.leadAction.processLead}
            <Badge variant="brand">{dict.common.soon}</Badge>
          </DialogTitle>
          <DialogDescription>
            {fmt(dict.leadAction.dialogIntro, { company: companyName })}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{i + 1}. {s.label}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          {dict.leadAction.resultNote}
        </p>
        <Button disabled className="w-full">
          <Check className="h-4 w-4" />
          {dict.leadAction.run}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
