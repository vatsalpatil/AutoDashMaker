import { Spinner } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

/** Page-level loader, centred in the available area. Pass `compact` for loaders inside cards/panels. */
export function Loading({ label = 'Loading…', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-muted-foreground', compact ? 'py-8' : 'min-h-[60vh]')}>
      <Spinner size="sm" label={label} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
