import { useState } from 'react';
import { Brain } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { MemoryState } from './useMemory';

/** Top strip: memory on/off, how much of it the AI gets, and a quick "remember this" box. */
export function RememberBox({ m }: { m: MemoryState }) {
  const [note, setNote] = useState('');
  const o = m.overview.data;
  const add = async () => { if (note.trim() && (await m.remember(note))) setNote(''); };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={o?.enabled ?? true} onCheckedChange={(v: boolean) => m.toggle(v)} aria-label="Use memory in AI answers" />
        Use memory in AI answers
      </label>
      {o && <span className="text-xs text-muted-foreground">{o.prompt_chars.toLocaleString()} / {o.prompt_limit.toLocaleString()} characters sent to the AI</span>}
      <div className="flex min-w-[16rem] flex-1 items-center gap-1">
        <Brain className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Remember this"
          placeholder="Remember… e.g. fiscal year starts in April"
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus:border-ring" />
        <button type="button" onClick={add} disabled={!note.trim() || m.remembering}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-40">Remember</button>
      </div>
    </div>
  );
}
