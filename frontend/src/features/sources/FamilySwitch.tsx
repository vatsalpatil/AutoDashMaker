import type { FAMILIES } from './sourceSchemas';
import { cn } from '@/lib/utils';

/** Segmented choice between the members of one source family (PostgreSQL | MySQL, REST | GraphQL). */
export function FamilySwitch({ family, value, onChange, disabled }: {
  family: (typeof FAMILIES)[number]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const active = family.members.find((m) => m.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{family.switchLabel}</span>
      <div role="radiogroup" aria-label={family.switchLabel} className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5">
        {family.members.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={m.id === value} disabled={disabled && m.id !== value}
            onClick={() => onChange(m.id)}
            className={cn('rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40',
              m.id === value ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {m.label}
          </button>
        ))}
      </div>
      {active && <span className="text-xs text-muted-foreground">{active.note}</span>}
    </div>
  );
}
