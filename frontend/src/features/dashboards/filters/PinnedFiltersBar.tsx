import type { ReactNode } from 'react';
import { Globe, PanelTop, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '../dashboardFilters';
import type { ParamControl } from '../params/DashboardParams';
import { allLabel, optionsFor, type PinnedFilter, type PinnedValues } from './pinnedModel';

const LABEL = 'flex items-center gap-1 text-[11px] font-medium text-muted-foreground';
const FIELD = 'h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** A query parameter (period switch, threshold) shown as a filter: segmented choice or a small box. Every tab. */
function ParamField({ c, value, onChange }: { c: ParamControl; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL} title="Applies on every tab"><Globe className="size-3" />{c.label}</span>
      {c.kind === 'choice' ? (
        <span className="flex h-8 items-center rounded-md bg-muted p-0.5">
          {(c.options ?? []).map((o) => (
            <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
              className={cn('h-full rounded-sm px-2.5 text-xs font-medium capitalize', value === o ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>{o}</button>
          ))}
        </span>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={c.kind === 'number' ? 'decimal' : undefined} aria-label={c.label} className={cn(FIELD, 'w-28')} />
      )}
    </label>
  );
}

/**
 * The dashboard's single Filters card (modelled on report dashboards): query parameters (Period…) and pinned dropdowns
 * side by side, one Apply / Reset for all of them, a "Showing: …" line, and the any-column builder under "More filters".
 */
export function PinnedFiltersBar({ filters, columns, draft, setDraft, params, paramValue, setParam, dirty, active, shown, apply, reset, onManage, more }: {
  filters: PinnedFilter[];
  columns: Record<string, ColumnInfo>;
  draft: PinnedValues;
  setDraft: (v: PinnedValues) => void;
  params: ParamControl[];
  paramValue: (c: ParamControl) => string;
  setParam: (name: string, v: string) => void;
  dirty: boolean;
  active: boolean;
  shown: string;
  apply: () => void;
  reset: () => void;
  onManage?: () => void;
  more?: ReactNode;
}) {
  const any = filters.length + params.length > 0;
  if (!any && !onManage && !more) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><SlidersHorizontal className="size-3.5" /> Filters</span>
        {params.map((c) => <ParamField key={c.name} c={c} value={paramValue(c)} onChange={(v) => setParam(c.name, v)} />)}
        {filters.map((f) => {
          const info = columns[f.field];
          const seen = f.kind === 'select' ? [...(info?.values ?? [])] : [...(info?.months ?? [])];
          const Icon = f.scope === 'all' ? Globe : PanelTop;
          return (
            <label key={f.id} className="flex min-w-36 flex-col gap-1">
              <span className={LABEL} title={f.scope === 'all' ? 'Applies on every tab' : 'Applies on this tab only'}><Icon className="size-3" />{f.label}</span>
              <select value={draft[f.id] ?? ''} onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })} aria-label={f.label} className={cn(FIELD, draft[f.id] && 'border-primary')}>
                <option value="">{allLabel(f.label)}</option>
                {optionsFor(f.kind, seen).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        })}
        {any && (
          <span className="flex items-center gap-1.5">
            <Button variant="primary" label="Apply" onClick={apply} isDisabled={!dirty} />
            <Button variant="secondary" icon={<RotateCcw className="size-3.5" />} label="Reset" onClick={reset} isDisabled={!active && !dirty} />
          </span>
        )}
        {onManage && <button type="button" onClick={onManage} className="mb-2 ml-auto text-xs font-medium text-primary hover:underline">{filters.length ? 'Manage filters' : '+ Add a filter for viewers'}</button>}
      </div>
      {any && <p className="mt-1.5 text-xs text-muted-foreground">{shown ? `Showing: ${shown}` : 'Showing all data'}{dirty ? ' · press Apply to update' : ''}</p>}
      {more && <div className="mt-2 border-t pt-2">{more}</div>}
    </div>
  );
}

