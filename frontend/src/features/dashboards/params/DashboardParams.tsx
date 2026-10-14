import { createContext, useContext, useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

/** One control generated from a `{{name|default}}` placeholder in the dashboard's SQL. */
export interface ParamControl { name: string; label: string; default: string; kind: 'choice' | 'number' | 'text'; options?: string[] }

/** The values every widget below runs its query with ('' key = all defaults, so caches stay shared). */
export const DashboardParamsContext = createContext<{ values: Record<string, string>; key: string }>({ values: {}, key: '' });
export const useDashboardParams = () => useContext(DashboardParamsContext);

/** Controls + current values for one dashboard. Only values that differ from the defaults are sent. */
export function useDashboardParamState(dashboardId: string) {
  const controls = useApi<ParamControl[]>(`/dashboards/${dashboardId}/params`).data ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const changed = useMemo(() => Object.fromEntries(Object.entries(values).filter(([k, v]) => controls.find((c) => c.name === k)?.default !== v && v !== '')), [values, controls]);
  const key = Object.keys(changed).length ? JSON.stringify(Object.entries(changed).sort()) : '';
  return { controls, values, set: (name: string, v: string) => setValues((s) => ({ ...s, [name]: v })), reset: () => setValues({}), ctx: { values: changed, key } };
}

/** The bar above the widgets: a segmented switch for periods, number / text boxes for thresholds and filters. */
export function DashboardParamsBar({ state }: { state: ReturnType<typeof useDashboardParamState> }) {
  const { controls, values, set, reset, ctx } = state;
  if (controls.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card px-3 py-2 text-sm" role="group" aria-label="Dashboard parameters">
      <SlidersHorizontal className="mb-1.5 size-4 text-muted-foreground" />
      {controls.map((c) => {
        const v = values[c.name] ?? c.default;
        return (
          <label key={c.name} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
            {c.kind === 'choice' ? (
              <span className="flex rounded-md bg-muted p-0.5">
                {(c.options ?? []).map((o) => (
                  <button key={o} type="button" aria-pressed={v === o} onClick={() => set(c.name, o)}
                    className={cn('rounded-sm px-2.5 py-1 text-xs font-medium capitalize', v === o ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>{o}</button>
                ))}
              </span>
            ) : (
              <input key={v} defaultValue={v} inputMode={c.kind === 'number' ? 'decimal' : undefined} title="Press Enter to apply"
                onBlur={(e) => set(c.name, e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="h-8 w-28 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            )}
          </label>
        );
      })}
      {ctx.key && <button type="button" onClick={reset} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Defaults</button>}
    </div>
  );
}
