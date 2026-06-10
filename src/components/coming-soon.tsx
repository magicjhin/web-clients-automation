import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Аккуратная заглушка для разделов, чей бэкенд ещё не готов
 * (Письма, CRM). Меню полное сразу — раздел честно помечен «скоро».
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-lime-300">
        <Icon className="h-7 w-7" />
      </span>
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="brand">скоро</Badge>
        </div>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {bullets && bullets.length > 0 && (
        <ul className="mx-auto mt-2 grid max-w-md gap-2 text-left text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
              <span className="text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
