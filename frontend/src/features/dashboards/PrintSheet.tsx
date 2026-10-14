import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMeasure } from '@/hooks/useMeasure';
import type { Dashboard, Widget } from '@/lib/types';
import { ContentCard, isContent } from './ContentCards';
import { DESIGN_PX, GAP_PX, ROW_PX, gridPlacement, SUB, pageRule, printZoom, rowCount, type PrintOptions } from './printLayout';
import { useWidgetData } from './useWidgetData';
import { WidgetBody } from './WidgetBody';

function PrintWidget({ widget }: { widget: Widget }) {
  const [bodyRef, bodySize] = useMeasure();
  const { chart } = useWidgetData(isContent(widget) ? null : widget.chart_id);
  const s = widget.settings ?? {};
  const title = typeof s.title === 'string' && s.title.trim() !== '' ? s.title : chart?.name ?? '';
  if (widget.kind === 'section') return <div className="flex h-full items-center border-b-2 border-border px-1 text-lg font-bold uppercase tracking-wide">{widget.title ?? 'Section'}</div>;
  if (isContent(widget)) return <ContentCard widget={widget} editing={false} onRemove={() => undefined} onEdit={() => undefined} />;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-3">
      <span className="mb-1 truncate text-sm font-semibold">{title}</span>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden"><WidgetBody widget={widget} height={bodySize.h} view="chart" fit print /></div>
    </div>
  );
}

/**
 * The printable version of a dashboard: every page, laid out at a fixed design width and zoomed to the chosen paper, so A4, A3 and Letter all
 * show the whole width. It mounts, waits for the charts to draw, opens the browser's print dialog, and calls onDone afterwards.
 * Only this sheet is visible when printing (see the `.print-sheet` rules in index.css).
 */
export function PrintSheet({ dashboard, pages, options, onDone }: { dashboard: Dashboard; pages: { id: string; name: string }[]; options: PrintOptions; onDone: () => void }) {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = pageRule(options);
    document.head.append(style);
    const finish = () => onDone();
    window.addEventListener('afterprint', finish, { once: true });
    const timer = setTimeout(() => window.print(), 1200);   // charts measure themselves and draw first
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', finish); style.remove(); };
  }, [options, onDone]);

  const widgets = (dashboard.widgets ?? []).filter((w) => !w.settings?.parked);
  return createPortal(
    <div className="print-sheet" style={{ zoom: printZoom(options) }}>
      <div style={{ width: DESIGN_PX }}>
        <header className="mb-3 flex items-baseline justify-between border-b pb-2">
          <h1 className="text-2xl font-bold">{dashboard.name}</h1>
          <span className="text-xs text-muted-foreground">{new Date().toLocaleString()}</span>
        </header>
        {pages.map((p) => {
          const items = widgets.filter((w) => (w.page ?? 'main') === p.id);
          if (items.length === 0) return null;
          return (
            <section key={p.id} className="print-page">
              {pages.length > 1 && <h2 className="mb-2 text-lg font-semibold">{p.name}</h2>}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${12 * SUB}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.ceil(rowCount(items) * SUB)}, ${(ROW_PX + GAP_PX) / SUB}px)` }}>
                {items.map((w) => <div key={w.id} className="print-widget min-h-0 min-w-0" style={{ ...gridPlacement(w), padding: GAP_PX / 2 }}><PrintWidget widget={w} /></div>)}
              </div>
            </section>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
