import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { useWidgetData } from './useWidgetData';
import { WidgetBody } from './WidgetBody';

function Slide({ widget }: { widget: Widget }) {
  const [bodyRef, bodySize] = useMeasure();
  const { chart } = useWidgetData(widget.chart_id);
  const s = widget.settings ?? {};
  const titleOverride = typeof s.title === 'string' && s.title.trim() !== '' ? s.title : null;
  if (widget.kind === 'section') {
    return (
      <div className="col-span-full flex h-full items-center rounded-lg bg-muted px-4">
        <span className="truncate text-lg font-bold uppercase tracking-wide">{widget.title ?? 'Section'}</span>
      </div>
    );
  }
  if (isContent(widget)) return <ContentCard widget={widget} editing={false} onRemove={() => undefined} onEdit={() => undefined} />;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card p-3">
      <span className="mb-1 truncate text-sm font-semibold">{titleOverride ?? chart?.name ?? ''}</span>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden">
        <WidgetBody widget={widget} height={bodySize.h} view="chart" fit />
      </div>
    </div>
  );
}

/**
 * Read-only render of one dashboard page at its saved positions (fractional too): widths are % of the space,
 * rows keep the dashboard's proportions (92 px at ~1500 px wide) and long pages scroll. Used by Present and share links.
 */
export function SavedLayout({ widgets }: { widgets: Widget[] }) {
  const [ref, size] = useMeasure();
  const totalRows = Math.max(1, ...widgets.map((w) => w.position.y + Math.max(w.position.h, 1)));
  const rowUnit = size.w > 0 ? Math.min(140, Math.max(80, 92 * (size.w / 1500))) : 92;
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-auto">
      <div className="relative" style={{ height: totalRows * rowUnit }}>
        {widgets.map((w) => (
          <div key={w.id} className="absolute min-h-0 min-w-0 p-1.5" style={{
            left: `${(Math.max(w.position.x, 0) / 12) * 100}%`,
            width: `${(Math.min(Math.max(w.position.w, 0.5), 12 - Math.max(w.position.x, 0)) / 12) * 100}%`,
            top: w.position.y * rowUnit,
            height: Math.max(w.position.h, 0.5) * rowUnit,
          }}>
            <Slide widget={w} />
          </div>
        ))}
        {widgets.length === 0 && <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No widgets on this page.</div>}
      </div>
    </div>
  );
}
