import { Responsive, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { WidgetView } from './WidgetView';
import { GroupBar, groupOf, useWidgetGroups } from './widgetGroups';

/** The draggable / resizable 12-column grid of widgets for one dashboard page. */
export function WidgetGrid({ widgets, layout, editing, onLayoutChange, onRemove, onFullscreen, onSettings, onSetting, gridX = 2, gridY = 4 }: {
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
  const g = useWidgetGroups(widgets, onSetting);
  const selectedGrouped = widgets.some((w) => g.selected.has(w.id) && groupOf(w));
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
    {editing && <GroupBar count={g.selected.size} canUngroup={selectedGrouped} onGroup={() => g.setGroup(`g${Date.now().toString(36)}`)} onUngroup={() => g.setGroup(null)} onClear={g.clear} />}
    {width > 0 && <Responsive
      width={width}
      className="layout"
      layouts={{ lg: layout }}
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
  );
}
