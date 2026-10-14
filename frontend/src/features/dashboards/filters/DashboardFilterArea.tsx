import { useState } from 'react';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/types';
import type { useDashboardFilterState } from '../dashboardFilters';
import type { ParamControl, useDashboardParamState } from '../params/DashboardParams';
import { ManageFiltersDialog } from './ManageFiltersDialog';
import { PinnedFiltersBar } from './PinnedFiltersBar';
import { summary } from './pinnedModel';

/**
 * Everything filter-related above the widgets, in ONE card: query parameters (Period…) and pinned dropdowns share a draft
 * and one Apply / Reset; the owner's "Manage filters" dialog; the any-column builder (all tabs / this tab) under "More filters".
 */
export function DashboardFilterArea({ df, params, dashboard, pages, activePage, onSaved }: {
  df: ReturnType<typeof useDashboardFilterState>;
  params: ReturnType<typeof useDashboardParamState>;
  dashboard: Dashboard;
  pages: { id: string; name: string }[];
  activePage: string;
  onSaved: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const [more, setMore] = useState(false);
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});
  const p = df.pinned;
  const applied = (c: ParamControl) => params.values[c.name] ?? c.default;
  const paramValue = (c: ParamControl) => paramDraft[c.name] ?? applied(c);
  const paramsDirty = params.controls.some((c) => paramValue(c) !== applied(c));
  const dirty = paramsDirty || JSON.stringify(p.draft) !== JSON.stringify(p.applied);
  const changedParams = params.controls.filter((c) => applied(c) !== c.default).map((c) => `${c.label} ${applied(c)}`);
  const shown = [...changedParams, summary(p.filters, p.applied)].filter(Boolean).join(' · ');
  const active = changedParams.length > 0 || Object.values(p.applied).some(Boolean);
  const apply = () => { p.apply(); for (const [k, v] of Object.entries(paramDraft)) params.set(k, v); setParamDraft({}); };
  const reset = () => { p.reset(); params.reset(); setParamDraft({}); };

  const builder = df.bar && (more || df.active
    ? <div className="flex flex-col gap-1">{df.bar}</div>
    : <button type="button" onClick={() => setMore(true)} className="text-xs font-medium text-muted-foreground hover:text-primary">+ More filters (any column, all tabs or this tab)</button>);
  return (
    <>
      <PinnedFiltersBar filters={p.filters} columns={p.columns} draft={p.draft} setDraft={p.setDraft}
        params={params.controls} paramValue={paramValue} setParam={(k, v) => setParamDraft((d) => ({ ...d, [k]: v }))}
        dirty={dirty} active={active} shown={shown} apply={apply} reset={reset} onManage={() => setManaging(true)} more={builder} />
      {managing && (
        <ManageFiltersDialog open onClose={() => setManaging(false)} filters={dashboard.filters ?? []} columns={p.columns} pages={pages} activePage={activePage}
          onSave={async (filters) => { await api.patch(`/dashboards/${dashboard.id}`, { name: dashboard.name, filters }); p.reset(); onSaved(); }} />
      )}
    </>
  );
}
