import { Responsive, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { WidgetView } from './WidgetView';
import { AutoLayoutBar, autoLayout } from './autoLayouts';
import type { Chart } from '@/lib/types';
import { groupOf, useWidgetGroups } from './widgetGroups';
import { BoxFrames, BoxList, boxesOf, isLocked, joinBox } from './widgetBoxes';

/** The draggable / resizable 12-column grid of widgets for one dashboard page. */
export function WidgetGrid({ widgets, layout, editing, onLayoutChange, onRemove, onFullscreen, onSettings, onSetting, charts = [], gridX = 2, gridY = 4 }: {
  charts?: Chart[];
  onSetting: (id: string, key: string, value: unknown) => void;
  gridX?: number;
  gridY?: number;
  widgets: Widget[];
  layout: Layout[];
  editing: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onRemove: (id: string) => void;
  onFullscreen: (w: Widget) => void;
  onSettings: (w: Widget) => void;
}) {
  const [ref, { w: width }] = useMeasure();
  const g = useWidgetGroups(widgets);
  const boxes = boxesOf(widgets);
  const chartName = new Map(charts.map((c) => [c.id, c.name]));
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const gridLayout = editing ? layout.map((l) => (byId.get(l.i) && isLocked(byId.get(l.i)!) ? { ...l, static: true } : l)) : layout;
  if (widgets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
        No widgets on this page yet — add charts to build this dashboard.
      </p>
    );
  }
  return (
    // measured with a ResizeObserver: the sidebar opening/closing resizes the container without a window resize
    <div ref={ref} className="min-w-0">
    {editing && <AutoLayoutBar onPick={(p) => {
      const type = new Map(charts.map((c) => [c.id, c.spec?.type as string | undefined]));
      onLayoutChange(autoLayout(p, widgets, (w) => type.get(w.chart_id), gridX, gridY));
    }} />}
    {editing && <BoxList boxes={boxes} selected={g.selected} set={onSetting}
      nameOf={(w) => String(w.settings?.title || w.title || chartName.get(w.chart_id) || 'Widget')}
      onCreate={() => { joinBox(g.selected, { id: `g${Date.now().toString(36)}`, name: `Box ${boxes.length + 1}`, locked: false }, onSetting); g.clear(); }} />}
    <div className="relative">
    {editing && width > 0 && <BoxFrames boxes={boxes} layout={layout} colW={width / (12 * gridX)} rowH={92 / gridY} />}
    {width > 0 && <Responsive
      width={width}
      className="layout"
      layouts={{ lg: gridLayout }}
      breakpoints={{ lg: 0 }}
      cols={{ lg: 12 * gridX }}
      rowHeight={92 / gridY}   // one stored row = 92 px whatever the snap; gaps come from each cell's padding
      margin={[0, 0]}
      draggableHandle=".widget-drag-handle"
      resizeHandles={['se', 'e', 's', 'w']}
      compactType={null}            // widgets stay where you put them: nothing jumps up to fill gaps
      preventCollision={false}
      draggableCancel="button, input, textarea, select, a"
      useCSSTransforms
      isDraggable={editing}
      isResizable={editing}
      onDragStop={g.onDragStop}
      onLayoutChange={(l) => onLayoutChange(g.applyGroupMove(l))}
    >
      {widgets.map((w) => (
        <div key={w.id}
          // Ctrl/Shift + click selects for grouping; selected = solid ring, grouped = dashed outline
          onClickCapture={(e) => { if (editing && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); g.toggle(w.id); } }}
          className={`p-1.5 ${editing && g.selected.has(w.id) ? '[&>*]:ring-2 [&>*]:ring-primary' : editing && groupOf(w) ? '[&>*]:outline-dashed [&>*]:outline-1 [&>*]:outline-primary/50' : ''}`}>
          {isContent(w)
            ? <ContentCard widget={w} editing={editing} onRemove={() => onRemove(w.id)} onEdit={() => onSettings(w)} />
            : <WidgetView widget={w} editing={editing} onRemove={() => onRemove(w.id)} onFullscreen={() => onFullscreen(w)} onSettings={() => onSettings(w)} />}
        </div>
      ))}
    </Responsive>}
    </div>
    </div>
  );
}
