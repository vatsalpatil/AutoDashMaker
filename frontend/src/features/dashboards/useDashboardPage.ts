import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { isParked } from './widgetGroups';
import type { BriefResponse, Chart, Dashboard, Widget } from '@/lib/types';

/** Grid snap: stored positions use 12 columns × 92 px rows (80 px + gap); the editor multiplies both by the chosen factors
 * so widgets move and resize in smaller steps. */
export const SNAPS = { coarse: { label: 'Coarse', x: 1, y: 1 }, normal: { label: 'Normal', x: 2, y: 4 }, fine: { label: 'Fine', x: 4, y: 8 }, free: { label: 'Free', x: 8, y: 16 } } as const;
export type SnapId = keyof typeof SNAPS;
const fromGrid = (l: Layout, gx: number, gy: number) => ({ x: l.x / gx, y: l.y / gy, w: l.w / gx, h: l.h / gy });

export interface LineageNode {
  [key: string]: unknown;
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || `page-${Date.now()}`;
}

/** All state and actions of the dashboard detail page: data, pages, layout editing, widgets, brief, lineage. */
export function useDashboardPage(id: string | undefined) {
  const [snap, setSnap] = useLocalStorage<SnapId>('dashboard.snap', 'normal');
  const { x: GRID_X, y: GRID_Y } = SNAPS[snap] ?? SNAPS.normal;
  const grid = useRef({ x: GRID_X, y: GRID_Y });
  grid.current = { x: GRID_X, y: GRID_Y };
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showLineage, setShowLineage] = useState(false);
  const [lineage, setLineage] = useState<LineageNode | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullscreenWidget, setFullscreenWidget] = useState<Widget | null>(null);
  const [settingsWidget, setSettingsWidget] = useState<Widget | null>(null);
  const [settingsChart, setSettingsChart] = useState<Chart | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [activePage, setActivePage] = useState('main');
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    api.get<Dashboard>(`/dashboards/${id}`).then(setDashboard).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    api.get<Chart[]>('/charts').then(setCharts).catch(() => {});
  }, []);

  const pages = useMemo(() => {
    if (dashboard?.pages && dashboard.pages.length > 0) return dashboard.pages;
    return [{ id: 'main', name: 'Overview' }];
  }, [dashboard]);

  // a dashboard whose pages are not called 'main' (AI-generated: overview, breakdown...) opens on its first page, not on an empty one
  useEffect(() => {
    if (!pages.some((p) => p.id === activePage)) setActivePage(pages[0].id);
  }, [pages, activePage]);

  const pageAll = useMemo(() => (dashboard?.widgets ?? []).filter((w) => (w.page ?? 'main') === activePage), [dashboard, activePage]);
  const widgets = useMemo(() => pageAll.filter((w) => !isParked(w)), [pageAll]);
  const parked = useMemo(() => pageAll.filter(isParked), [pageAll]);

  // the grid is finer than the stored positions (24 columns, quarter rows) so drag/resize moves in small, smooth steps
  const layout: Layout[] = useMemo(
    () =>
      widgets.map((w) => ({
        i: w.id,
        x: Math.round(w.position.x * GRID_X),
        y: Math.round(w.position.y * GRID_Y),
        w: Math.round(Math.min(Math.max(w.position.w, 0.5), 12) * GRID_X),
        h: Math.round(Math.max(w.position.h, 0.5) * GRID_Y),
        static: !editing,
      })),
    [widgets, editing, GRID_X, GRID_Y],
  );

  const pendingLayout = useRef<Layout[] | null>(null);

  const flushLayoutSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingLayout.current;
    if (!pending) return Promise.resolve();
    pendingLayout.current = null;
    return api
      .put(`/dashboards/${id}/layout`, {
        layout: pending.map((l) => ({ id: l.i, ...fromGrid(l, grid.current.x, grid.current.y) })),
      })
      .then(() => undefined)
      .catch((e) => setError(e.message));
  }, [id]);

  /** Apply grid positions locally right away (the grid never snaps back) and save them after a short pause. */
  const savePositions = useCallback((newLayout: Layout[]) => {
    setDashboard((prev) => {
      if (!prev) return prev;
      const byId = new Map(newLayout.map((l) => [l.i, l]));
      return { ...prev, widgets: (prev.widgets ?? []).map((w) => { const l = byId.get(w.id); return l ? { ...w, position: fromGrid(l, grid.current.x, grid.current.y) } : w; }) };
    });
    pendingLayout.current = newLayout;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushLayoutSave, 800);
  }, [flushLayoutSave]);
  /** Drag / resize in the editor. */
  const onLayoutChange = useCallback((newLayout: Layout[]) => { if (editing) savePositions(newLayout); }, [editing, savePositions]);
  /** Auto height of content-sized widgets while viewing; never while editing (it would fight the user's own resizing). */
  const applyAutoFit = useCallback((newLayout: Layout[]) => { if (!editing) savePositions(newLayout); }, [editing, savePositions]);

  // leaving the page (e.g. browser back from the layout editor) still saves the pending layout
  const flushRef = useRef(flushLayoutSave);
  flushRef.current = flushLayoutSave;
  useEffect(() => () => { flushRef.current(); }, []);

  /** Persist immediately (don't lose the last drag) and resolve once the server has it, so a reload shows the new layout. */
  async function finishEditing() {
    setEditing(false);
    await flushLayoutSave();
  }

  async function addWidget(chartId: string) {
    try {
      const maxY = widgets.reduce((m, w) => Math.max(m, w.position.y + w.position.h), 0);
      await api.post(`/dashboards/${id}/widgets`, {
        chart_id: chartId,
        position: { x: 0, y: maxY, w: 6, h: 4 },
        page: activePage,
      });
      setPickerOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const [contentEdit, setContentEdit] = useState<Widget | null>(null);
  const [contentNew, setContentNew] = useState<'text' | 'link' | 'iframe' | null>(null);

  function openSettings(w: Widget) {
    if (w.kind === 'text' || w.kind === 'link' || w.kind === 'iframe') { setContentEdit(w); return; }
    setSettingsWidget(w);
    api.get<Chart>(`/charts/${w.chart_id}`).then(setSettingsChart).catch(() => setSettingsChart(null));
  }

  async function updateWidgetSetting(widgetId: string, key: string, value: unknown) {
    // optimistic local update
    setDashboard((d) =>
      d
        ? {
            ...d,
            widgets: (d.widgets ?? []).map((w) =>
              w.id === widgetId ? { ...w, settings: { ...(w.settings ?? {}), [key]: value } } : w,
            ),
          }
        : d,
    );
    setSettingsWidget((w) =>
      w && w.id === widgetId ? { ...w, settings: { ...(w.settings ?? {}), [key]: value } } : w,
    );
    try {
      await api.patch(`/dashboards/${id}/widgets/${widgetId}`, { settings: { [key]: value } });
    } catch (e) {
      setError((e as Error).message);
      load(); // revert to server state on failure
    }
  }

  async function saveContent(v: { kind: 'text' | 'link' | 'iframe'; title: string; settings: Record<string, unknown> }) {
    try {
      if (contentEdit) {
        await api.patch(`/dashboards/${id}/widgets/${contentEdit.id}`, { title: v.title, settings: v.settings });
      } else {
        const maxY = widgets.reduce((m, w) => Math.max(m, w.position.y + w.position.h), 0);
        await api.post(`/dashboards/${id}/widgets`, { kind: v.kind, title: v.title, settings: v.settings, page: activePage, position: { x: 0, y: maxY, w: v.kind === 'iframe' ? 12 : 6, h: v.kind === 'iframe' ? 6 : 2 } });
      }
      setContentEdit(null); setContentNew(null); load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function duplicate(): Promise<string | null> {
    try { return (await api.post<{ id: string }>(`/dashboards/${id}/duplicate`, {})).id; } catch (e) { setError((e as Error).message); return null; }
  }

  async function removeWidget(widgetId: string) {
    try {
      await api.del(`/dashboards/${id}/widgets/${widgetId}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addPage() {
    const name = newPageName.trim();
    if (!name || !dashboard) return;
    const existing = dashboard.pages && dashboard.pages.length > 0 ? dashboard.pages : [{ id: 'main', name: 'Overview' }];
    const newPage = { id: slugify(name), name };
    try {
      await api.patch(`/dashboards/${id}`, {
        name: dashboard.name,
        description: dashboard.description ?? '',
        pages: [...existing, newPage],
      });
      setNewPageName('');
      setNewPageOpen(false);
      setActivePage(newPage.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleLineage() {
    if (!showLineage && !lineage) {
      try {
        const l = await api.get<LineageNode>(`/dashboards/${id}/lineage`);
        setLineage(l);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    setShowLineage((s) => !s);
  }

  async function toggleBrief() {
    if (!showBrief && !brief) {
      setBriefBusy(true);
      try {
        const b = await api.get<BriefResponse>(`/dashboards/${id}/brief`);
        setBrief(b);
      } catch (e) {
        setError((e as Error).message);
        setBriefBusy(false);
        return;
      }
      setBriefBusy(false);
    }
    setShowBrief((s) => !s);
  }
  return {
    snap, setSnap, gridX: GRID_X, gridY: GRID_Y,
    dashboard, charts, error, setError, load, pages, widgets, parked, layout, activePage, setActivePage, applyAutoFit,
    editing, setEditing, finishEditing, onLayoutChange,
    pickerOpen, setPickerOpen, fullscreenWidget, setFullscreenWidget,
    settingsWidget, setSettingsWidget, settingsChart, openSettings, updateWidgetSetting,
    presenting, setPresenting, newPageOpen, setNewPageOpen, newPageName, setNewPageName, addPage,
    showLineage, lineage, toggleLineage, showBrief, brief, briefBusy, toggleBrief,
    addWidget, removeWidget, contentEdit, setContentEdit, contentNew, setContentNew, saveContent, duplicate,
  };
}
