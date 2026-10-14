import { Responsive, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { WidgetView } from './WidgetView';
import { useResizePush } from './resizePush';
import { InsertLine, useDropInsert } from './dropInsert';
import { groupOf, type WidgetGroups } from './widgetGroups';
import { BoxFrames, boxesOf, isLocked } from './widgetBoxes';

/** The draggable / resizable 12-column grid of widgets for one dashboard page. */
export function WidgetGrid({ widgets, layout, editing, onLayoutChange, onRemove, onFullscreen, onSettings, groups: g, plainSelect = false, dropSize, onDropWidget, gridX = 2, gridY = 4 }: {
  groups: WidgetGroups;
  dropSize?: { w: number; h: number } | null;   // set while a parked widget is dragged from the editor's tray
  onDropWidget?: (layout: Layout[], item: Layout) => void;
  plainSelect?: boolean;   // full editor: a plain click selects (Ctrl/Shift adds); inline: only Ctrl/Shift
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
  const push = useResizePush(12 * gridX);
  const ins = useDropInsert(12 * gridX);
  const boxes = boxesOf(widgets);
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const gridLayout = editing ? layout.map((l) => (byId.get(l.i) && isLocked(byId.get(l.i)!) ? { ...l, static: true } : l)) : layout;
  if (widgets.length === 0 && !editing) {
    return (
      <p className="rounded-lg border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
        No widgets on this page yet — add charts to build this dashboard.
      </p>
    );
  }
  return (
    // measured with a ResizeObserver: the sidebar opening/closing resizes the container without a window resize
    <div ref={ref} className="min-w-0">
    <div className={`relative ${editing ? 'min-h-[60vh]' : ''}`}>
    {editing && width > 0 && <InsertLine hint={ins.hint} colW={width / (12 * gridX)} rowH={92 / gridY} />}
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
      allowOverlap   // nothing moves while dragging; dropInsert / resizePush open space themselves
      draggableCancel="button, input, textarea, select, a"
      useCSSTransforms
      isDraggable={editing}
      isResizable={editing}
      isDroppable={editing && !!onDropWidget}
      droppingItem={{ i: '__drop__', w: dropSize?.w ?? 6 * gridX, h: dropSize?.h ?? 3 * gridY }}
      onDrop={(l: Layout[], item: Layout | undefined) => item && onDropWidget?.(l.filter((x) => x.i !== '__drop__'), item)}
      onDragStart={ins.onDragStart}
      onDrag={ins.onDrag}
      onDragStop={(l, o, n) => { g.onDragStop(l, o, n); ins.onDragStop(l, o, n); }}
      onResizeStart={push.onResizeStart}
      onResize={push.onResize}
      onLayoutChange={(l) => onLayoutChange(g.applyGroupMove(ins.apply(l, g.hasMates)))}
    >
      {widgets.map((w) => (
        <div key={w.id}
          // Ctrl/Shift + click selects for grouping; selected = solid ring, grouped = dashed outline
          onClickCapture={(e) => {
            if (!editing) return;
            const add = e.ctrlKey || e.metaKey || e.shiftKey;
            if (add) { e.preventDefault(); e.stopPropagation(); g.toggle(w.id); }
            else if (plainSelect && !(e.target as HTMLElement).closest('button, a, input, textarea, select')) g.select([w.id]);
          }}
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
