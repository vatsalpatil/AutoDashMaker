import { useState } from 'react';
import { Copy, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { Notebook } from '../useNotebook';

/** Saved notebooks: open one, start a new one, rename, duplicate, delete. Cells are saved as you type; results are re-run. */
export function NotebooksTab({ notebooks, filter }: { notebooks: Notebook['notebooks']; filter: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const q = filter.trim().toLowerCase();
  const items = notebooks.items.filter((n) => !q || n.name.toLowerCase().includes(q) || n.cells.some((c) => (c.sql ?? '').toLowerCase().includes(q)));
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={notebooks.create} className="flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-xs font-medium text-primary hover:bg-accent">
        <Plus className="size-3.5" /> New notebook
      </button>
      {items.length === 0 && <p className="p-2 text-xs text-muted-foreground">No notebook matches.</p>}
      <ul className="flex flex-col gap-1">
        {items.map((n) => (
          <li key={n.id} className={cn('group rounded-md border px-2 py-1.5', n.id === notebooks.activeId ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent')}>
            <div className="flex items-center gap-1.5">
              <FileText className={cn('size-3.5 shrink-0', n.id === notebooks.activeId ? 'text-primary' : 'text-muted-foreground')} />
              {editing === n.id
                ? <input autoFocus defaultValue={n.name} aria-label="Notebook name" className="min-w-0 flex-1 rounded border bg-background px-1 text-xs"
                    onBlur={(e) => { notebooks.rename(n.id, e.target.value); setEditing(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
                : <button type="button" onClick={() => notebooks.open(n.id)} className="min-w-0 flex-1 truncate text-left text-xs font-medium" title={n.name}>{n.name}</button>}
              <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" onClick={() => setEditing(n.id)} aria-label={`Rename ${n.name}`} title="Rename" className="rounded p-1 text-muted-foreground hover:text-foreground"><Pencil className="size-3" /></button>
                <button type="button" onClick={() => notebooks.duplicate(n.id)} aria-label={`Duplicate ${n.name}`} title="Duplicate" className="rounded p-1 text-muted-foreground hover:text-foreground"><Copy className="size-3" /></button>
                <button type="button" onClick={() => confirm(`Delete the notebook “${n.name}”?`) && notebooks.remove(n.id)} aria-label={`Delete ${n.name}`} title="Delete" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </span>
            </div>
            <p className="pl-5 text-[10px] text-muted-foreground">{n.cells.length} cell{n.cells.length === 1 ? '' : 's'} · {timeAgo(new Date(n.updatedAt).toISOString())}{n.id === notebooks.activeId ? ' · open' : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
