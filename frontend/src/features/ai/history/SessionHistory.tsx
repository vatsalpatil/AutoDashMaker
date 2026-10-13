import { useState } from 'react';
import { Check, History, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, timeAgo } from '@/lib/utils';
import type { AiSessions } from './useAiSessions';

/** "History" button: saved chats of this kind — open one to continue it, rename, delete, or start a new chat. */
export function SessionHistory({ h, busy, onOpen, onNew, label = 'History', className }: {
  h: Pick<AiSessions, 'items' | 'currentId' | 'saving' | 'rename' | 'remove'>; busy?: boolean;
  onOpen: (id: string) => void; onNew: () => void; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" title="Saved chats" aria-label="Chat history"
        className={cn('flex items-center gap-1.5 rounded-full border bg-card/80 px-3 py-1 text-xs backdrop-blur transition-colors hover:border-primary hover:text-primary', className)} />}>
        <History className="size-3.5" /> {label} <span className="tabular-nums text-muted-foreground">{h.items.length}</span>
        {h.saving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : h.currentId ? <Check className="size-3 text-success" aria-label="Saved" /> : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <button type="button" disabled={busy} onClick={() => { onNew(); setOpen(false); }}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent disabled:opacity-50">
          <Plus className="size-3.5" /> New chat
        </button>
        {h.items.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No saved chats yet. Chats save automatically as you work.</p>}
        <ul className="max-h-96 overflow-y-auto" aria-label="Saved chats">
          {h.items.map((c) => (
            <li key={c.id} className={cn('group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-accent', c.id === h.currentId && 'bg-accent')}>
              {editing === c.id
                ? <input autoFocus defaultValue={c.title} aria-label="Chat name" className="min-w-0 flex-1 rounded border bg-background px-1 text-xs"
                    onBlur={(e) => { void h.rename(c.id, e.target.value); setEditing(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
                : <button type="button" disabled={busy} onClick={() => { onOpen(c.id); setOpen(false); }} className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <span className="block truncate text-xs font-medium">{c.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{c.summary ? `${c.summary} · ` : ''}{timeAgo(c.updated_at)}</span>
                  </button>}
              <button type="button" onClick={() => setEditing(c.id)} aria-label={`Rename ${c.title}`} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"><Pencil className="size-3" /></button>
              <button type="button" disabled={busy && c.id === h.currentId} onClick={() => confirm(`Delete the chat “${c.title}”?`) && void h.remove(c.id)} aria-label={`Delete ${c.title}`}
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 disabled:hidden"><Trash2 className="size-3" /></button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
