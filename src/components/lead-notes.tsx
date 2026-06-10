'use client';

/**
 * lead-notes.tsx — комментарий по обработке лида (чтобы не терять/не забыть клиента).
 * UI-first: поле работает локально, сохранение подключится с LeadDelivery (per-lead notes).
 */
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function LeadNotes() {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Заметка: что сделал, что дальше (перезвонить, выслать КП…)"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Сохранение подключится с CRM</span>
        <Button size="sm" variant="outline" disabled>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
