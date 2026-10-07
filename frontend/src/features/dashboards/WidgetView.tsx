import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink, GripVertical, Maximize2, Settings2, Table2, X } from 'lucide-react';
import { useMeasure } from '@/hooks/useMeasure';
import type { Widget } from '@/lib/types';
import { useWidgetData } from './useWidgetData';
import { WidgetBody } from './WidgetBody';

const TITLE_SIZE_CLS: Record<string, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' };

export function SectionWidgetView({
  widget,
  editing,
  onRemove,
}: {
  widget: Widget;
  editing: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center justify-between gap-1 bg-blue-100 px-3 py-2 dark:bg-blue-900">
        <div className="flex min-w-0 items-center gap-1">
          {editing && (
            <span className="widget-drag-handle cursor-grab text-blue-400 hover:text-blue-600 dark:hover:text-blue-300" aria-label="Drag section">
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <span className="truncate text-sm font-bold uppercase tracking-wide text-blue-800 dark:text-blue-100">
            {widget.title ?? 'Section'}
          </span>
        </div>
        <button onClick={onRemove} className="shrink-0 text-blue-400 hover:text-destructive" aria-label="Remove section">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1" />
    </div>
  );
}

export function WidgetView({
  widget,
  editing,
  onRemove,
  onFullscreen,
  onSettings,
}: {
  widget: Widget;
  editing: boolean;
  onRemove: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
}) {
  const { chart } = useWidgetData(widget.chart_id);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [fit, setFit] = useState(true); // fit = auto-resize to widget; scroll = natural size + scroll
  const [bodyRef, bodySize] = useMeasure();

  const bodyOverflow = view === 'table' ? 'overflow-auto' : fit ? 'overflow-hidden' : 'overflow-auto';
  const s = widget.settings ?? {};
  const titleOverride = typeof s.title === 'string' && s.title.trim() !== '' ? s.title : null;
  const titleCls = TITLE_SIZE_CLS[String(s.titleSize ?? 'md')] ?? 'text-sm';

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-3 ">
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {editing && (
            <span className="widget-drag-handle cursor-grab text-muted-foreground/70 hover:text-muted-foreground" aria-label="Drag widget">
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <span className={`truncate font-semibold ${titleCls}`}>{titleOverride ?? chart?.name ?? `Chart #${widget.chart_id}`}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {editing && (
            <button onClick={onSettings} className="text-muted-foreground/70 hover:text-blue-500" aria-label="Widget settings" title="Widget settings">
              <Settings2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
            className="text-muted-foreground/70 hover:text-blue-500"
            aria-label="Toggle chart/table view"
            title={view === 'chart' ? 'Show as table' : 'Show as chart'}
          >
            {view === 'chart' ? <Table2 className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
          </button>
          {view === 'chart' && (
            <button
              onClick={() => setFit((f) => !f)}
              className={`text-xs font-medium ${fit ? 'text-blue-500' : 'text-muted-foreground/70 hover:text-blue-500'}`}
              title={fit ? 'Auto-fit is on — chart fills the widget. Click for scrollable natural size.' : 'Scroll mode — click to auto-fit the widget.'}
            >
              {fit ? 'Fit' : 'Scroll'}
            </button>
          )}
          <button onClick={onFullscreen} className="text-muted-foreground/70 hover:text-blue-500" aria-label="Fullscreen widget">
            <Maximize2 className="h-4 w-4" />
          </button>
          <Link to={`/charts/${widget.chart_id}`} className="text-muted-foreground/70 hover:text-blue-500" aria-label="Open chart detail">
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button onClick={onRemove} className="text-muted-foreground/70 hover:text-destructive" aria-label="Remove widget">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={bodyRef} className={`min-h-0 flex-1 ${bodyOverflow}`}>
        <WidgetBody widget={widget} height={bodySize.h} view={view} fit={fit} />
      </div>
    </div>
  );
}
