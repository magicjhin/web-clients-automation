'use client';

/**
 * lead-notes.tsx — комментарий по обработке лида (чтобы не терять/не забыть клиента).
 * UI-first: поле работает локально, сохранение подключится с LeadDelivery (per-lead notes).
 */
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/provider';

export function LeadNotes() {
  const [value, setValue] = useState('');
  const { dict } = useI18n();
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={dict.leadNotes.placeholder}
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{dict.leadNotes.saveHint}</span>
        <Button size="sm" variant="outline" disabled>
          {dict.leadNotes.save}
        </Button>
      </div>
    </div>
  );
}
