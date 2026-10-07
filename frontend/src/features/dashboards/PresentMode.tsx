import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMeasure } from '@/hooks/useMeasure';
import type { Dashboard, Widget } from '@/lib/types';
import { useWidgetData } from './useWidgetData';
import { WidgetBody } from './WidgetBody';

function PresentSlide({ widget }: { widget: Widget }) {
  const [bodyRef, bodySize] = useMeasure();
  const { chart } = useWidgetData(widget.chart_id);
  const s = widget.settings ?? {};
  const titleOverride = typeof s.title === 'string' && s.title.trim() !== '' ? s.title : null;
  if (widget.kind === 'section') {
    return (
      <div className="col-span-full flex items-center rounded-lg bg-slate-800 px-4">
        <span className="truncate text-lg font-bold uppercase tracking-wide text-slate-100">{widget.title ?? 'Section'}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-card p-3">
      <span className="mb-1 truncate text-sm font-semibold">{titleOverride ?? chart?.name ?? `Chart #${widget.chart_id}`}</span>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden">
        <WidgetBody widget={widget} height={bodySize.h} view="chart" fit />
      </div>
    </div>
  );
}

export function PresentMode({
  dashboard,
  pages,
  onClose,
}: {
  dashboard: Dashboard;
  pages: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const count = pages.length;

  const next = useCallback(() => setPageIdx((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setPageIdx((i) => (i - 1 + count) % count), [count]);

  useEffect(() => {
    try {
      overlayRef.current?.requestFullscreen?.();
    } catch {
      /* optional */
    }
    return () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
      } catch {
        /* optional */
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, next, prev]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(next, 10000);
    return () => clearInterval(t);
  }, [auto, next]);

  const page = pages[Math.min(pageIdx, count - 1)];
  const pageWidgets = (dashboard.widgets ?? []).filter((w) => (w.page ?? 'main') === page.id);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex flex-col bg-slate-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-50">{dashboard.name}</h2>
          <span className="text-sm text-muted-foreground/70">
            {page.name} · {pageIdx + 1}/{count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground/70">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-blue-600" />
            Auto-advance (10s)
          </label>
          {count > 1 && (
            <>
              <button onClick={prev} className="rounded-md p-1 text-muted-foreground/70 hover:bg-slate-800 hover:text-white" aria-label="Previous page">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={next} className="rounded-md p-1 text-muted-foreground/70 hover:bg-slate-800 hover:text-white" aria-label="Next page">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground/70 hover:bg-slate-800 hover:text-white" aria-label="Exit presentation">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-[80px] grid-cols-12 gap-3 overflow-auto">
        {pageWidgets.map((w) => (
          <div
            key={w.id}
            style={{
              gridColumn: `${Math.min(w.position.x, 11) + 1} / span ${Math.min(Math.max(w.position.w, 1), 12)}`,
              gridRow: `span ${Math.max(w.position.h, 1)}`,
            }}
          >
            <PresentSlide widget={w} />
          </div>
        ))}
        {pageWidgets.length === 0 && (
          <div className="col-span-12 flex items-center justify-center text-sm text-muted-foreground/70">No widgets on this page.</div>
        )}
      </div>
      {count > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPageIdx(i)}
              aria-label={`Go to ${p.name}`}
              className={`h-2 w-2 rounded-full ${i === pageIdx ? 'bg-blue-500' : 'bg-slate-600 hover:bg-slate-400'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
