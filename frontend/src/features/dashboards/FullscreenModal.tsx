import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Widget } from '@/lib/types';
import { useWidgetData } from './useWidgetData';
import { WidgetBody } from './WidgetBody';

export function FullscreenModal({ widget, onClose }: { widget: Widget; onClose: () => void }) {
  const { chart } = useWidgetData(widget.chart_id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-50">{chart?.name ?? `Chart #${widget.chart_id}`}</h2>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground/70 hover:bg-slate-800 hover:text-white" aria-label="Close fullscreen">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-card p-4">
        <WidgetBody widget={widget} height={window.innerHeight - 160} />
      </div>
    </div>
  );
}
