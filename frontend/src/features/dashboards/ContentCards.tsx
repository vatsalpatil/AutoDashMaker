import { ExternalLink, FileText, GripVertical, Globe, Link2, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Markdown } from '@/components/common/Markdown';
import type { Widget } from '@/lib/types';
import { useDashboardFilters } from './dashboardFilters';

export const isContent = (w: Widget) => w.kind === 'text' || w.kind === 'link' || w.kind === 'iframe';

/** `{{Column}}` in a text card shows that column's current dashboard filter value(s), or "all" when it is not filtered. */
function fill(text: string, values: Record<string, string[]>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name: string) => (values[name]?.length ? values[name].join(', ') : 'all'));
}

const safeUrl = (u: unknown) => (typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u.trim()) ? u.trim() : '');

/** Body of a text, link or embed card. */
export function ContentBody({ widget }: { widget: Widget }) {
  const filters = useDashboardFilters();
  const s = widget.settings ?? {};
  const values = filters?.values ?? {};
  if (widget.kind === 'text') return <div className="h-full overflow-auto text-sm"><Markdown text={fill(String(s.content ?? ''), values)} /></div>;
  const url = safeUrl(s.url);
  if (!url) return <p className="text-xs text-muted-foreground">Set a link (http://, https:// or a path like /charts).</p>;
  if (widget.kind === 'iframe') {
    return <iframe src={fill(url, values)} title={widget.title ?? 'Embedded page'} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" className="h-full w-full rounded-md border-0" loading="lazy" />;
  }
  const inner = (
    <span className="flex h-full flex-col justify-center gap-1">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ExternalLink className="size-4" />{widget.title || url}</span>
      {s.description ? <span className="text-xs text-muted-foreground">{String(s.description)}</span> : null}
      <span className="truncate text-[11px] text-muted-foreground/70">{url}</span>
    </span>
  );
  return url.startsWith('/') ? <Link to={url} className="block h-full">{inner}</Link> : <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>;
}

const ICON = { text: FileText, link: Link2, iframe: Globe } as const;

/** Card frame for content widgets: drag handle + edit / remove while editing the layout. */
export function ContentCard({ widget, editing, onRemove, onEdit }: { widget: Widget; editing: boolean; onRemove: () => void; onEdit: () => void }) {
  const Icon = ICON[widget.kind as keyof typeof ICON] ?? FileText;
  const bare = widget.kind === 'text' && !widget.title;
  return (
    <div className={`group flex h-full flex-col overflow-hidden rounded-lg ${bare ? 'p-1' : 'border border-border bg-card p-3'}`}>
      {(!bare || editing) && (
        <div className="mb-1 flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {editing && <span className="widget-drag-handle cursor-grab text-muted-foreground/70 hover:text-muted-foreground" aria-label="Drag card"><GripVertical className="h-4 w-4" /></span>}
            {widget.kind !== 'link' && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
            {widget.kind !== 'link' && widget.title && <span className="truncate text-sm font-semibold">{widget.title}</span>}
          </div>
          {editing && (
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onEdit} className="text-muted-foreground/70 hover:text-blue-500" aria-label="Edit card" title="Edit card"><Pencil className="h-4 w-4" /></button>
              <button onClick={onRemove} className="text-muted-foreground/70 hover:text-destructive" aria-label="Remove card"><X className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1"><ContentBody widget={widget} /></div>
    </div>
  );
}
