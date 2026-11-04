import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { PAGES, type Go } from './docsNav';

/** Header search over page titles, groups and keywords. Ctrl/⌘+K focuses it. */
export function DocsSearch({ go }: { go: Go }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? PAGES.filter((p) => words.every((w) => `${p.title} ${p.group} ${p.tab} ${p.keywords ?? ''}`.toLowerCase().includes(w))).slice(0, 8) : [];
  const pick = (id: string) => { go(id); setQ(''); setOpen(false); input.current?.blur(); };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input ref={input} value={q} placeholder="Search docs…" aria-label="Search docs"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0].id); if (e.key === 'Escape') input.current?.blur(); }}
        className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-14 text-sm outline-none focus:border-primary" />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-card px-1.5 text-[10px] text-muted-foreground sm:block">Ctrl K</kbd>
      {open && words.length > 0 && (
        <div className="absolute inset-x-0 top-11 z-40 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {hits.length ? hits.map((p) => (
            <button key={p.id} type="button" onMouseDown={() => pick(p.id)} className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted">
              <span className="text-sm font-medium">{p.title}</span><span className="text-xs text-muted-foreground">{p.tab} · {p.group}</span>
            </button>
          )) : <p className="px-3 py-3 text-sm text-muted-foreground">No pages match “{q}”.</p>}
        </div>
      )}
    </div>
  );
}
