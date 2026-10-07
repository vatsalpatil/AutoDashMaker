import { Responsive, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { WidgetView } from './WidgetView';

/** The draggable / resizable 12-column grid of widgets for one dashboard page. */
export function WidgetGrid({ widgets, layout, editing, onLayoutChange, onRemove, onFullscreen, onSettings }: {
  widgets: Widget[];
  layout: Layout[];
  editing: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onRemove: (id: string) => void;
  onFullscreen: (w: Widget) => void;
  onSettings: (w: Widget) => void;
}) {
  const [ref, { w: width }] = useMeasure();
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
    {width > 0 && <Responsive
      width={width}
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 0 }}
      cols={{ lg: 12 }}
      rowHeight={80}
      margin={[12, 12]}
      draggableHandle=".widget-drag-handle"
      isDraggable={editing}
      isResizable={editing}
      onLayoutChange={onLayoutChange}
    >
      {widgets.map((w) => (
        <div key={w.id}>
          {isContent(w)
            ? <ContentCard widget={w} editing={editing} onRemove={() => onRemove(w.id)} onEdit={() => onSettings(w)} />
            : <WidgetView widget={w} editing={editing} onRemove={() => onRemove(w.id)} onFullscreen={() => onFullscreen(w)} onSettings={() => onSettings(w)} />}
        </div>
      ))}
    </Responsive>}
    </div>
  );
}
