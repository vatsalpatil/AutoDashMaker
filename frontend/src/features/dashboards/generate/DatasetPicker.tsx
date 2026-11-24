import { Check, Database, Folder, Layers } from 'lucide-react';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';

const NO_FOLDER = 'Other tables';

/** Choose the data to work on: one table, several, a whole folder (project) or all. Several are combined along their
 *  relationships. Tables are grouped by folder so a project's files sit together. */
export function DatasetPicker({ datasets, value, onChange }: { datasets: Dataset[]; value: string[]; onChange: (ids: string[]) => void }) {
  const all = datasets.length > 1 && value.length === datasets.length;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const groups = new Map<string, Dataset[]>();
  for (const d of datasets) groups.set(d.folder || NO_FOLDER, [...(groups.get(d.folder || NO_FOLDER) ?? []), d]);
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === NO_FOLDER ? 1 : b === NO_FOLDER ? -1 : a.localeCompare(b)));
  // the icon swaps but keeps its size, so selecting a chip never moves the ones after it
  const chip = (on: boolean) => cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
    on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground');
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Data</span>
        {datasets.length > 1 && (
          <button type="button" aria-pressed={all} onClick={() => onChange(all ? [datasets[0].id] : datasets.map((d) => d.id))} className={chip(all)}>
            <Layers className="size-3.5" /> All tables
          </button>
        )}
      </div>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto" role="group" aria-label="Datasets to use">
        {ordered.map(([folder, items]) => {
          const ids = items.map((d) => d.id);
          const whole = ids.every((id) => value.includes(id));
          return (
            <div key={folder} className="flex flex-wrap items-center gap-1.5">
              {groups.size > 1 && (
                <button type="button" aria-pressed={whole} title={whole ? 'Clear this folder' : 'Use every table in this folder'}
                  onClick={() => onChange(whole ? value.filter((v) => !ids.includes(v)) : ids)}
                  className="inline-flex w-36 shrink-0 items-center gap-1.5 truncate text-xs font-medium text-muted-foreground hover:text-foreground">
                  <Folder className="size-3.5 shrink-0" /> <span className="truncate">{folder}</span> <span className="text-[10px]">({items.length})</span>
                </button>
              )}
              {items.map((d) => {
                const on = value.includes(d.id);
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => toggle(d.id)} className={chip(on)} title={`${d.row_count?.toLocaleString() ?? '?'} rows`}>
                    {on ? <Check className="size-3.5" /> : <Database className="size-3.5" />} {d.name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length > 1
          ? `${value.length} tables: they'll be combined into one along your saved relationships (tables that would repeat rows are left out and named).`
          : 'Pick one table, a folder (click its name), or several to combine them.'}
      </p>
    </div>
  );
}
