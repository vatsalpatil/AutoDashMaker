import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { SavedQuery } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

function SavedNode({ q, onLoad, onAddStep, onDelete }: {
  q: SavedQuery;
  onLoad: (q: SavedQuery) => void;
  onAddStep: (sql: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pretty, setPretty] = useState<string | null>(null);

  useEffect(() => {
    if (!open || pretty !== null) return;
    api.post<{ sql: string }>('/queries/format', { sql: q.sql }).then((r) => setPretty(r.sql)).catch(() => setPretty(q.sql));
  }, [open, pretty, q.sql]);

  return (
    <li className="rounded-md border">
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${q.name}`} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{q.name}</span>
      </div>
      <div className="flex flex-wrap gap-x-2 px-2 pb-1 text-[10px] text-muted-foreground">
        {q.row_count != null && <span>{q.row_count.toLocaleString()} rows</span>}
        {q.duration_ms != null && <span>· {Math.round(q.duration_ms)} ms</span>}
        {q.created_at && <span>· {timeAgo(q.created_at)}</span>}
      </div>
      {open && (
        <div className="flex flex-col gap-1.5 border-t p-1.5">
          <pre className="mono max-h-44 overflow-auto whitespace-pre-wrap rounded-sm bg-muted p-2 text-[11px]">{pretty ?? 'Formatting…'}</pre>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onLoad(q)} className="flex-1 rounded-sm bg-muted px-2 py-1 text-[11px] font-medium hover:bg-accent">Load</button>
            <button type="button" onClick={() => onAddStep(q.sql)} className="flex-1 rounded-sm bg-muted px-2 py-1 text-[11px] font-medium hover:bg-accent">Add as step</button>
            <button type="button" aria-label={`Delete ${q.name}`} onClick={() => confirm(`Delete saved query “${q.name}”?`) && onDelete(q.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Saved queries as cards that expand to the formatted SQL. */
export function SavedTab({ queries, onLoad, onAddStep, onDelete }: {
  queries: SavedQuery[];
  onLoad: (q: SavedQuery) => void;
  onAddStep: (sql: string) => void;
  onDelete: (id: string) => void;
}) {
  if (queries.length === 0) return <p className="p-2 text-xs text-muted-foreground">No match.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {queries.map((s) => <SavedNode key={s.id} q={s} onLoad={onLoad} onAddStep={onAddStep} onDelete={onDelete} />)}
    </ul>
  );
}
