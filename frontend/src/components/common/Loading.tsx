import { Spinner } from '@/components/ui/kit';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted-foreground">
      <Spinner size="sm" label={label} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
