import { useState } from 'react';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/types';
import type { useDashboardFilterState } from '../dashboardFilters';
import { ManageFiltersDialog } from './ManageFiltersDialog';
import { PinnedFiltersBar } from './PinnedFiltersBar';

/**
 * Everything filter-related above the widgets: the pinned filter panel (labelled dropdowns, Apply / Reset), the owner's
 * "Manage filters" dialog, and the ad-hoc "All tabs" / "This tab" filter builder under "More filters".
 */
export function DashboardFilterArea({ df, dashboard, pages, activePage, onSaved }: {
  df: ReturnType<typeof useDashboardFilterState>;
  dashboard: Dashboard;
  pages: { id: string; name: string }[];
  activePage: string;
  onSaved: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const [more, setMore] = useState(false);
  const p = df.pinned;
  return (
    <div className="flex flex-col gap-2">
      <PinnedFiltersBar {...p} onManage={() => setManaging(true)} />
      {df.bar && (more || df.active
        ? <div className="flex flex-col gap-1">{df.bar}</div>
        : <button type="button" onClick={() => setMore(true)} className="self-start text-xs font-medium text-muted-foreground hover:text-primary">+ More filters (any column, all tabs or this tab)</button>)}
      {managing && (
        <ManageFiltersDialog open onClose={() => setManaging(false)} filters={dashboard.filters ?? []} columns={p.columns} pages={pages} activePage={activePage}
          onSave={async (filters) => { await api.patch(`/dashboards/${dashboard.id}`, { name: dashboard.name, filters }); p.reset(); onSaved(); }} />
      )}
    </div>
  );
}
