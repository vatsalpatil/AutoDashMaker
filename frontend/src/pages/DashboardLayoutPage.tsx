import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, EyeOff, Plus, Redo2, Undo2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { Button } from '@/components/ui/kit';
import { WidgetSettingsPanel } from '@/components/WidgetSettingsPanel';
import type { Widget } from '@/lib/types';
import { AddWidgetDialog } from '@/features/dashboards/AddWidgetDialog';
import { autoLayout } from '@/features/dashboards/autoLayouts';
import { ContentDialog } from '@/features/dashboards/ContentDialog';
import { DashboardFilterProvider, useDashboardFilterState } from '@/features/dashboards/dashboardFilters';
import { DashboardIdContext } from '@/features/dashboards/dashboardRefresh';
import { LayoutInspector } from '@/features/dashboards/layoutEditor/LayoutInspector';
import { LayoutSidebar } from '@/features/dashboards/layoutEditor/LayoutSidebar';
import { nudge } from '@/features/dashboards/layoutEditor/layoutOps';
import { useEditorKeys } from '@/features/dashboards/layoutEditor/useEditorKeys';
import { useLayoutHistory } from '@/features/dashboards/layoutEditor/useLayoutHistory';
import { SNAPS, type SnapId, useDashboardPage } from '@/features/dashboards/useDashboardPage';
import { isLocked, joinBox, boxesOf } from '@/features/dashboards/widgetBoxes';
import { useWidgetGroups } from '@/features/dashboards/widgetGroups';
import { WidgetGrid } from '@/features/dashboards/WidgetGrid';

const tool = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40';

/** Full-screen layout editor: widget list / presets / boxes on the left, the canvas, and an inspector on the right. */
export default function DashboardLayoutPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useDashboardPage(id);
  const df = useDashboardFilterState();
  const g = useWidgetGroups(d.widgets);
  const { setEditing } = d;
  useEffect(() => setEditing(true), [setEditing]);

  const byId = new Map(d.widgets.map((w) => [w.id, w]));
  const layout = d.layout.map((l) => (byId.get(l.i) && isLocked(byId.get(l.i)!) ? { ...l, static: true } : l));
  const h = useLayoutHistory(layout, d.onLayoutChange);
  const cols = 12 * d.gridX;
  const chartName = new Map(d.charts.map((c) => [c.id, c.name]));
  const nameOf = (w: Widget) => String(w.settings?.title || w.title || chartName.get(w.chart_id) || 'Widget');
  const newBox = () => { joinBox(g.selected, { id: `g${Date.now().toString(36)}`, name: `Box ${boxesOf(d.widgets).length + 1}`, locked: false }, d.updateWidgetSetting); g.clear(); };

  const [dragging, setDragging] = useState<Widget | null>(null);
  const park = (ids: Iterable<string>, on = true) => { for (const wid of ids) d.updateWidgetSetting(wid, 'parked', on); g.clear(); };
  const place = (rest: typeof layout, item: { x: number; y: number }) => {
    if (!dragging) return;
    const p = dragging.position;
    d.updateWidgetSetting(dragging.id, 'parked', false);
    h.commit([...rest, { i: dragging.id, x: Math.min(item.x, cols - Math.round(p.w * d.gridX)), y: item.y, w: Math.round(p.w * d.gridX), h: Math.round(p.h * d.gridY) }]);
    setDragging(null);
  };

  useEditorKeys({
    nudge: (dx, dy, big) => g.selected.size && h.commit(nudge(layout, g.selected, dx * (big ? d.gridX : 1), dy * (big ? d.gridY : 1), cols)),
    undo: h.undo, redo: h.redo, all: () => g.select(d.widgets.map((w) => w.id)), clear: g.clear,
  });

  if (!d.dashboard) return d.error ? <ErrorBanner message={d.error} /> : <Loading />;
  const done = () => { d.finishEditing(); nav(`/dashboards/${id}`); };

  return (
    <DashboardIdContext.Provider value={d.dashboard.id}>
    <DashboardFilterProvider api={df.api}>
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="font-semibold">Layout · {d.dashboard.name}</span>
        <div className="flex gap-1">
          {d.pages.map((p) => (
            <button key={p.id} type="button" onClick={() => { g.clear(); d.setActivePage(p.id); }}
              className={d.activePage === p.id ? 'rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground' : 'rounded-full border px-2.5 py-0.5 text-xs hover:border-primary'}>{p.name}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button type="button" className={tool} disabled={!h.canUndo} onClick={h.undo} title="Undo (Ctrl+Z)"><Undo2 className="size-3.5" />Undo</button>
          <button type="button" className={tool} disabled={!h.canRedo} onClick={h.redo} title="Redo (Ctrl+Y)"><Redo2 className="size-3.5" />Redo</button>
          <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">Snap
            <select value={d.snap} onChange={(e) => d.setSnap(e.target.value as SnapId)} className="rounded-md border bg-background px-1.5 py-1 text-foreground">
              {(Object.keys(SNAPS) as SnapId[]).map((k) => <option key={k} value={k}>{SNAPS[k].label}</option>)}
            </select>
          </label>
          <button type="button" className={tool} disabled={!d.widgets.length} onClick={() => park(d.widgets.map((w) => w.id))} title="Move every widget on this page to the Off layout tray"><EyeOff className="size-3.5" />Clear layout</button>
          <button type="button" className={tool} onClick={() => d.setPickerOpen(true)}><Plus className="size-3.5" />Add widget</button>
          <Button variant="primary" icon={<Check className="h-4 w-4" />} label="Done" onClick={done} />
        </div>
      </header>
      <ErrorBanner message={d.error} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r p-3">
          <LayoutSidebar widgets={d.widgets} parked={d.parked} onDragParked={setDragging} onRestoreAll={() => park(d.parked.map((w) => w.id), false)} selected={g.selected} nameOf={nameOf} onSetting={d.updateWidgetSetting} onCreateBox={newBox}
            onSelect={(wid, add) => (add ? g.toggle(wid) : g.select([wid]))}
            onPreset={(p) => {
              const type = new Map(d.charts.map((c) => [c.id, c.spec?.type as string | undefined]));
              h.commit(autoLayout(p, d.widgets, (w) => type.get(w.chart_id), d.gridX, d.gridY));
            }} />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4" onClick={(e) => e.target === e.currentTarget && g.clear()}>
          <WidgetGrid widgets={d.widgets} layout={layout} editing groups={g} plainSelect onDropWidget={place}
            dropSize={dragging && { w: Math.round(dragging.position.w * d.gridX), h: Math.round(dragging.position.h * d.gridY) }} gridX={d.gridX} gridY={d.gridY}
            onLayoutChange={h.commit} onRemove={d.removeWidget} onFullscreen={() => {}} onSettings={d.openSettings} />
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Click to select · Ctrl/Shift+click to add · arrows nudge (Shift = bigger) · Ctrl+Z / Ctrl+Y · Ctrl+A · Esc</p>
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</h3>
          <LayoutInspector layout={layout} selected={g.selected} widgets={d.widgets} gx={d.gridX} gy={d.gridY} nameOf={nameOf} commit={h.commit}
            onSetting={d.updateWidgetSetting} onSettings={d.openSettings} onRemove={(wid) => { g.clear(); d.removeWidget(wid); }} onBox={newBox} onPark={() => park(g.selected)} />
        </aside>
      </div>
      {d.settingsWidget && (
        <WidgetSettingsPanel widget={d.settingsWidget} chart={d.settingsChart}
          onChange={(key, value) => d.updateWidgetSetting(d.settingsWidget!.id, key, value)} onClose={() => d.setSettingsWidget(null)} />
      )}
      <AddWidgetDialog open={d.pickerOpen} charts={d.charts} onPick={d.addWidget} onContent={(k) => { d.setPickerOpen(false); d.setContentNew(k); }} onClose={() => d.setPickerOpen(false)} />
      {(d.contentNew || d.contentEdit) && (
        <ContentDialog open kind={d.contentEdit ? (d.contentEdit.kind as 'text' | 'link' | 'iframe') : d.contentNew!} widget={d.contentEdit}
          onSave={d.saveContent} onClose={() => { d.setContentEdit(null); d.setContentNew(null); }} />
      )}
    </div>
    </DashboardFilterProvider>
    </DashboardIdContext.Provider>
  );
}
