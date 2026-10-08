import { cn } from '@/lib/utils';

/** A row of single-choice quick filters (All · Favorites · New this week…), with optional counts. */
export function QuickChips<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick filters">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === o.id ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-primary/50 hover:text-foreground')}>
          {o.label}{o.count !== undefined && <span className="tabular-nums opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
