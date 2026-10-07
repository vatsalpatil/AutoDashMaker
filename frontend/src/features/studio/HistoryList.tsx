import { Star, Trash2 } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { statusTone } from './studioModel';
import type { HistoryItem } from './useSend';

/** Past requests of one kind (starred ones first and kept when clearing); click to load it back into the editor. */
export function HistoryList({ items, onPick, onClear, onToggleSaved }: { items: HistoryItem[]; onPick: (i: HistoryItem) => void; onClear: () => void; onToggleSaved: (id: string) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">History</h3>
        {items.length > 0 && <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /> Clear</button>}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && <li className="p-3 text-sm text-muted-foreground">Requests you send appear here; star one to keep it.</li>}
        {[...items].sort((a, b) => Number(!!b.saved) - Number(!!a.saved)).map((i) => (
          <li key={i.id} className="relative">
            <button type="button" onClick={() => onPick(i)} className="block w-full border-b px-3 py-2 text-left hover:bg-accent">
              <span className="flex items-center gap-2 text-xs"><b>{i.method}</b><span className={cn('font-medium', statusTone(i.status))}>{i.status}</span><span className="text-muted-foreground">{i.ms} ms · {timeAgo(new Date(i.at).toISOString())}</span></span>
              <span className="mono mt-0.5 block truncate text-xs text-muted-foreground" title={i.url}>{i.url}</span>
            </button>
            <button type="button" aria-label={i.saved ? 'Remove from saved' : 'Save request'} onClick={() => onToggleSaved(i.id)} className="absolute right-2 top-2 text-muted-foreground hover:text-warning"><Star className={cn('size-3.5', i.saved && 'fill-warning text-warning')} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
