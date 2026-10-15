import type { Layout } from 'react-grid-layout';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { WidgetView } from './WidgetView';

/**
 * Phone view of a dashboard page: the 12-column grid squeezed to ~375 px makes every card unreadable, so widgets are
 * listed in reading order (top-to-bottom, left-to-right), small ones (KPIs) two per row, the rest full width.
 * Read-only on purpose: nothing here reports heights or layout back, so the desktop layout is never overwritten.
 */
export function MobileStack({ widgets, layout, cols, rowPx, onFullscreen }: {
  widgets: Widget[];
  layout: Layout[];
  cols: number;
  rowPx: number;
  onFullscreen: (w: Widget) => void;
}) {
  const pos = new Map(layout.map((l) => [l.i, l]));
  const ordered = [...widgets].sort((a, b) => {
    const pa = pos.get(a.id), pb = pos.get(b.id);
    return (pa?.y ?? 0) - (pb?.y ?? 0) || (pa?.x ?? 0) - (pb?.x ?? 0);
  });
  return (
    <div className="grid grid-cols-2 gap-3">
      {ordered.map((w) => {
        const l = pos.get(w.id);
        const small = !!l && l.w <= cols / 4;
        return (
          <div key={w.id} className={small ? 'col-span-1' : 'col-span-2'} style={{ height: Math.max(160, (l?.h ?? 3) * rowPx) }}>
            {isContent(w)
              ? <ContentCard widget={w} editing={false} onRemove={() => {}} onEdit={() => {}} />
              : <WidgetView widget={w} editing={false} onRemove={() => {}} onFullscreen={() => onFullscreen(w)} onSettings={() => {}} />}
          </div>
        );
      })}
    </div>
  );
}
