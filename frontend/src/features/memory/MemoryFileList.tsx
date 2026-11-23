import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { MemoryState } from './useMemory';

/** Left column: the memory files (MEMORY.md first) and a box to add a new one. */
export function MemoryFileList({ m }: { m: MemoryState }) {
  const [name, setName] = useState('');
  const files = m.overview.data?.files ?? [];
  const add = async () => { if (name.trim() && (await m.create(name))) setName(''); };
  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 md:w-64">
      {files.map((f) => (
        <button key={f.name} type="button" onClick={() => m.setOpen(f.name)}
          className={`flex flex-col items-start rounded-md border px-3 py-2 text-left hover:bg-accent ${f.name === m.open ? 'border-primary bg-accent' : 'border-transparent'}`}>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />{f.name}
            {f.main && <span className="rounded bg-primary/15 px-1 text-[10px] text-primary">main</span>}
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{f.preview || 'empty'}</span>
        </button>
      ))}
      <div className="mt-2 flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="new-file.md" aria-label="New memory file name"
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus:border-ring" />
        <button type="button" onClick={add} disabled={!name.trim()} title="Add memory file"
          className="rounded-md border px-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
