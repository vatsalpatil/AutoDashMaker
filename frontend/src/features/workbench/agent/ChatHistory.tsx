import { useState } from 'react';
import { History, Pencil, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, timeAgo } from '@/lib/utils';
import type { ChatItem } from './useAgent';

/** Saved AI chats: open one, rename it, delete it. The running chat cannot be switched away from or deleted. */
export function ChatHistory({ items, activeId, busy, onOpen, onRename, onRemove }: {
  items: ChatItem[]; activeId: string; busy: boolean;
  onOpen: (id: string) => void; onRename: (id: string, name: string) => void; onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" title="Chat history" aria-label="Chat history"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" />}>
        <History className="size-3.5" /> History <span className="text-[10px]">{items.length}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <ul className="max-h-80 overflow-y-auto" aria-label="Chats">
          {items.map((c) => (
            <li key={c.id} className={cn('group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-accent', c.id === activeId && 'bg-accent')}>
              {editing === c.id
                ? <input autoFocus defaultValue={c.name} aria-label="Chat name" className="min-w-0 flex-1 rounded border bg-background px-1 text-xs"
                    onBlur={(e) => { onRename(c.id, e.target.value); setEditing(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
                : <button type="button" disabled={busy && c.id !== activeId} onClick={() => { onOpen(c.id); setOpen(false); }} className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <span className="block truncate text-xs font-medium">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.messages.filter((m) => m.role === 'user').length} messages · {timeAgo(new Date(c.updatedAt).toISOString())}</span>
                  </button>}
              <button type="button" onClick={() => setEditing(c.id)} aria-label={`Rename ${c.name}`} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"><Pencil className="size-3" /></button>
              <button type="button" disabled={busy && c.id === activeId} onClick={() => confirm(`Delete the chat “${c.name}”?`) && onRemove(c.id)} aria-label={`Delete ${c.name}`}
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 disabled:hidden"><Trash2 className="size-3" /></button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
