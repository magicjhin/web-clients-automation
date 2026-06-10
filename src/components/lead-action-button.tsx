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

const STEPS = [
  { icon: Gauge, label: 'Аудит сайта (PageSpeed + проблемы)' },
  { icon: FileText, label: 'Отчёт по аудиту' },
  { icon: Mail, label: 'Письмо с предложением (литовский)' },
];

export function LeadActionButton({
  companyName,
  size = 'sm',
}: {
  companyName: string;
  size?: 'sm' | 'default';
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Sparkles className="h-4 w-4" />
          Обработать
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Обработать лид
            <Badge variant="brand">скоро</Badge>
          </DialogTitle>
          <DialogDescription>
            Одна кнопка для «{companyName}» запустит всю цепочку:
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground text-amber-400">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{i + 1}. {s.label}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Готовые аудит и письмо попадут в раздел «Проверка» — там подтверждаешь отправку.
          Запуск подключится с генерацией (Claude + PageSpeed).
        </p>
        <Button disabled className="w-full">
          <Check className="h-4 w-4" />
          Запустить (подключится скоро)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
