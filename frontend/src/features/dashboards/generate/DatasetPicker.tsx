import { Check, Database, Layers } from 'lucide-react';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Choose the data to work on: one table, several, or all. Several are combined along their relationships. */
export function DatasetPicker({ datasets, value, onChange }: { datasets: Dataset[]; value: string[]; onChange: (ids: string[]) => void }) {
  const all = datasets.length > 1 && value.length === datasets.length;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const chip = (on: boolean) => cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
    on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground');
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Data</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Datasets to use">
        {datasets.length > 1 && (
          <button type="button" aria-pressed={all} onClick={() => onChange(all ? [datasets[0].id] : datasets.map((d) => d.id))} className={chip(all)}>
            <Layers className="size-3.5" /> All tables
          </button>
        )}
        {datasets.map((d) => {
          const on = value.includes(d.id);
          return (
            <button key={d.id} type="button" aria-pressed={on} onClick={() => toggle(d.id)} className={chip(on)} title={`${d.row_count?.toLocaleString() ?? '?'} rows`}>
              {on ? <Check className="size-3.5" /> : <Database className="size-3.5" />} {d.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length > 1
          ? `${value.length} tables: they'll be combined into one along your saved relationships (tables that would repeat rows are left out and named).`
          : 'Pick one table, or several to combine them.'}
      </p>
    </div>
  );
}
