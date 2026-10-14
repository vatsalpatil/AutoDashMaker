import { Globe, PanelTop, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '../dashboardFilters';
import { allLabel, optionsFor, summary, type PinnedFilter, type PinnedValues } from './pinnedModel';

/**
 * The dashboard's filter panel (modelled on report dashboards): one labelled dropdown per pinned field, "All …" by default,
 * a scope icon (every tab / this tab), then Apply and Reset so several changes recompute once.
 */
export function PinnedFiltersBar({ filters, columns, draft, setDraft, applied, apply, reset, onManage }: {
  filters: PinnedFilter[];
  columns: Record<string, ColumnInfo>;
  draft: PinnedValues;
  setDraft: (v: PinnedValues) => void;
  applied: PinnedValues;
  apply: () => void;
  reset: () => void;
  onManage?: () => void;
}) {
  if (filters.length === 0 && !onManage) return null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const any = Object.values(applied).some(Boolean);
  const shown = summary(filters, applied);
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><SlidersHorizontal className="size-3.5" /> Filters</span>
        {filters.map((f) => {
          const info = columns[f.field];
          const seen = f.kind === 'select' ? [...(info?.values ?? [])] : [...(info?.months ?? [])];
          const Icon = f.scope === 'all' ? Globe : PanelTop;
          return (
            <label key={f.id} className="flex min-w-36 flex-col gap-1">
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground" title={f.scope === 'all' ? 'Applies on every tab' : 'Applies on this tab only'}>
                <Icon className="size-3" />{f.label}
              </span>
              <select value={draft[f.id] ?? ''} onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })} aria-label={f.label}
                className={cn('h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50', draft[f.id] && 'border-primary')}>
                <option value="">{allLabel(f.label)}</option>
                {optionsFor(f.kind, seen).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        })}
        {filters.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Button variant="primary" label="Apply" onClick={apply} isDisabled={!dirty} />
            <Button variant="secondary" icon={<RotateCcw className="size-3.5" />} label="Reset" onClick={reset} isDisabled={!any && !dirty} />
          </span>
        )}
        {onManage && <button type="button" onClick={onManage} className="mb-2 ml-auto text-xs font-medium text-primary hover:underline">{filters.length ? 'Manage filters' : '+ Add a filter for viewers'}</button>}
      </div>
      {filters.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{shown ? `Showing: ${shown}` : 'Showing all data'}{dirty ? ' · press Apply to update' : ''}</p>}
    </div>
  );
}
