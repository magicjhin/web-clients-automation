import { cn } from '@/lib/utils';

/**
 * Вордмарк бренда: leads.webvibe.
 * `leads` — основной, `.webvibe` — приглушён. По умолчанию для тёмного фона.
 */
export function Brand({
  className,
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 font-semibold tracking-tight',
        className
      )}
    >
      <span
        className={cn(
          'grid h-6 w-6 place-items-center rounded-md text-sm font-bold',
          tone === 'light'
            ? 'bg-lime-300 text-black'
            : 'bg-black text-lime-300'
        )}
        aria-hidden
      >
        l
      </span>
      <span className={tone === 'light' ? 'text-white' : 'text-foreground'}>
        leads
        <span
          className={
            tone === 'light' ? 'text-sidebar-muted' : 'text-muted-foreground'
          }
        >
          .webvibe
        </span>
      </span>
    </span>
  );
}
