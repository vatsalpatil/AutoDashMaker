import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { activeConditions, isOr, matches } from '@/components/common/useFieldFilters';
import { Filters } from '@/components/reui/filters/filters';
import { createFilterQuery, createFilterRule, isFilterQueryEmpty } from '@/components/reui/filters/filters-query';
import type { FilterField, FilterQuery } from '@/components/reui/filters/filters-types';
import { Globe, PanelTop } from 'lucide-react';
import type { QueryResult } from '@/lib/types';

const MAX_OPTIONS = 30;

interface ColumnInfo { values: Set<string>; many: boolean }
export interface DashboardFilterApi {
  /** Narrow a widget's rows by the dashboard filters (only filters on columns the widget has apply). */
  apply: (result: QueryResult) => QueryResult;
  /** Widgets tell the dashboard which columns (and values) exist, so the filter menu can offer them. */
  register: (chartId: string, result: QueryResult) => void;
  /** Current filter values by column (for {{Column}} in text cards). */
  values: Record<string, string[]>;
  /** Cross-filter: clicking a bar / slice / point filters the whole dashboard to that value; clicking it again clears it. */
  pick: (field: string, value: string) => void;
}

const Ctx = createContext<DashboardFilterApi | null>(null);
export const useDashboardFilters = () => useContext(Ctx);
export const DashboardFilterProvider = ({ api, children }: { api: DashboardFilterApi; children: ReactNode }) => <Ctx.Provider value={api}>{children}</Ctx.Provider>;

/** Both filter scopes: `global` applies on every tab, `pages[id]` only on that tab. Widgets get both (AND). */
export interface ScopedFilters { global: FilterQuery; pages: Record<string, FilterQuery> }
export const emptyFilters = (): ScopedFilters => ({ global: createFilterQuery([]), pages: {} });

const narrow = (result: QueryResult, query: FilterQuery): QueryResult => {
  const conds = activeConditions(query).filter((c) => result.columns.includes(c.field));
  if (conds.length === 0) return result;
  const any = isOr(query);
  const rows = result.rows.filter((r) => {
    const test = (c: (typeof conds)[number]) => matches(r[c.field] as string | number | null | undefined, c);
    return any ? conds.some(test) : conds.every(test);
  });
  return { ...result, rows, row_count: rows.length };
};

/**
 * Dashboard filters in two scopes, "All tabs" and "This tab" (ReUI Filters). They apply to every widget having the
 * column; columns come from the widgets' own data, so the menus only offer what the dashboard can actually filter.
 */
export function useDashboardFilterState(activePage = 'main', pageName = 'this tab') {
  const [state, setState] = useState<ScopedFilters>(emptyFilters);
  const [columns, setColumns] = useState<Record<string, ColumnInfo>>({});
  const pageQuery = state.pages[activePage] ?? createFilterQuery([]);
  const setGlobal = useCallback((global: FilterQuery) => setState((s) => ({ ...s, global })), []);
  const setPage = useCallback((q: FilterQuery) => setState((s) => ({ ...s, pages: { ...s.pages, [activePage]: q } })), [activePage]);

  const register = useCallback((_chartId: string, result: QueryResult) => {
    setColumns((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of result.columns) {
        const info = next[c] ?? { values: new Set<string>(), many: false };
        const before = info.values.size;
        for (const r of result.rows) {
          if (info.values.size > MAX_OPTIONS) break;
          const v = r[c];
          if (v !== null && v !== undefined && v !== '') info.values.add(String(v));
        }
        const many = info.values.size > MAX_OPTIONS;
        if (!next[c] || info.values.size !== before || many !== info.many) { next[c] = { values: info.values, many }; changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  // the widgets on screen all belong to the active tab: all-tabs filters first, then this tab's
  const apply = useCallback((result: QueryResult): QueryResult => narrow(narrow(result, state.global), pageQuery), [state.global, pageQuery]);

  /** Cross-filter (click a bar / slice): filters THIS tab only; clicking the same value again clears it. */
  const pick = useCallback((field: string, value: string) => setPage((() => {
    const q = pageQuery;
    const id = `pick:${field}`;
    const had = q.rules.find((r) => r.id === id);
    const rules = q.rules.filter((r) => r.id !== id);
    if (had && (had as { value?: unknown }).value === value) return { ...q, rules };
    return { ...q, rules: [...rules, createFilterRule({ id, path: [field], operator: 'is', value })] };
  })()), [pageQuery, setPage]);
  const values = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of [...activeConditions(state.global), ...activeConditions(pageQuery)]) out[c.field] = c.values.map(String);
    return out;
  }, [state.global, pageQuery]);

  const fields = useMemo(() => Object.entries(columns).map(([id, info]) => (info.many
    ? { id, label: id, type: 'text' }
    : { id, label: id, type: 'select', options: [...info.values].sort().map((v) => ({ value: v, label: v })) }) as FilterField), [columns]);

  const api = useMemo<DashboardFilterApi>(() => ({ apply, register, values, pick }), [apply, register, values, pick]);
  const row = (label: string, hint: string, Icon: typeof Globe, q: FilterQuery, set: (q: FilterQuery) => void) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex w-24 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground" title={hint}><Icon className="size-3.5" />{label}</span>
      <Filters fields={fields} query={q} onQueryChange={set} showClear />
    </div>
  );
  const bar = fields.length > 0 ? (
    <div className="flex flex-col gap-1.5">
      {row('All tabs', 'These filters apply on every tab of the dashboard', Globe, state.global, setGlobal)}
      {row('This tab', `These filters apply only on ${pageName}`, PanelTop, pageQuery, setPage)}
    </div>
  ) : null;
  const active = !isFilterQueryEmpty(state.global) || Object.values(state.pages).some((q) => !isFilterQueryEmpty(q));
  return { api, bar, active, state, setState };
}
