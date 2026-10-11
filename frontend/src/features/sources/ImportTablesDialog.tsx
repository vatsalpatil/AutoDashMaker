import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Loader2, Search } from 'lucide-react';
import { Button, Dialog } from '@/components/ui/kit';
import { Checkbox } from '@/components/ui/checkbox';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { Source } from '@/lib/types';

type Status = 'pending' | 'running' | 'done' | string;

/** Browse the tables of a connected database/API and import the chosen ones as datasets. */
export function ImportTablesDialog({ source, onClose, onImported }: { source: Source | null; onClose: () => void; onImported: () => void }) {
  const { data, error, loading } = useApi<{ items: { name: string; kind: string }[] }>(source ? `/sources/${source.id}/discover` : null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [progress, setProgress] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);
  const linkable = ['mysql', 'postgres', 'sqlite'].includes(source?.type ?? '');  // only databases can be queried live
  const [chosen, setMode] = useState<'link' | 'copy'>('link');
  const mode = linkable ? chosen : 'copy';

  useEffect(() => { setPicked(new Set()); setFilter(''); setProgress({}); setDbs(null); }, [source?.id]);

  const items = data?.items ?? [];
  const groupOf = (n: string) => (n.includes('.') ? n.split('.')[0] : '');
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(groupOf(i.name), (m.get(groupOf(i.name)) ?? 0) + 1);
    return m.size > 1 ? [...m] : [];   // only worth showing when tables live in 2+ databases
  }, [items]);
  const [dbs, setDbs] = useState<Set<string> | null>(null);   // null = every database
  const active = (g: string) => dbs === null || dbs.has(g);
  const toggleDb = (g: string) => setDbs((d) => { const n = new Set(d ?? groups.map(([k]) => k)); if (n.has(g)) n.delete(g); else n.add(g); return n.size === groups.length ? null : n; });
  const shown = useMemo(() => items.filter((i) => active(groupOf(i.name)) && i.name.toLowerCase().includes(filter.trim().toLowerCase())), [items, filter, dbs]);
  const toggle = (name: string) => setPicked((p) => { const n = new Set(p); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  async function run() {
    if (!source) return;
    setBusy(true);
    const names = [...picked];
    setProgress(Object.fromEntries(names.map((n) => [n, 'pending'])));
    for (const name of names) {
      setProgress((p) => ({ ...p, [name]: 'running' }));
      try {
        await api.post('/datasets/ingest', { source_id: source.id, name, dataset_name: name, mode });
        setProgress((p) => ({ ...p, [name]: 'done' }));
      } catch (e) {
        setProgress((p) => ({ ...p, [name]: (e as Error).message }));
      }
    }
    setBusy(false);
    onImported();
  }

  const finished = Object.keys(progress).length > 0 && !busy;
  const failed = Object.values(progress).some((s) => !['pending', 'running', 'done'].includes(s));

  return (
    <Dialog isOpen={!!source} onOpenChange={(o) => !o && !busy && onClose()}>
      <div className="flex max-h-[80vh] w-[32rem] max-w-full flex-col gap-3 p-6">
        <div>
          <h2 className="text-lg font-semibold">Add tables from {source?.name}</h2>
          <p className="text-sm text-muted-foreground">Each table you pick becomes a dataset you can query, chart and ask about.</p>
        </div>
        {linkable && <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Import mode">
          {([
            ['link', 'Schema only (live)', 'Imports column names, types and row count. Queries run against the source, so data is always current.'],
            ['copy', 'Copy the data', 'Imports every row into this app. Faster to query and works offline; refresh to update.'],
          ] as const).map(([id, title, text]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} disabled={busy} onClick={() => setMode(id)}
              className={cn('rounded-lg border p-2.5 text-left transition-colors', mode === id ? 'border-primary bg-primary/10' : 'hover:bg-accent')}>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{text}</span>
            </button>
          ))}
        </div>}
        {groups.length > 0 && <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium">
            <span>1. Choose {source?.type === 'mysql' ? 'database(s)' : 'schema(s)'}</span>
            <span className="flex gap-3 text-primary">
              <button type="button" onClick={() => setDbs(null)}>All</button>
              <button type="button" onClick={() => setDbs(new Set())}>None</button>
            </span>
          </div>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {groups.map(([g, n]) => (
              <button key={g} type="button" aria-pressed={active(g)} onClick={() => toggleDb(g)} disabled={busy}
                className={cn('rounded-full border px-2.5 py-1 text-xs', active(g) ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent')}>
                {g || '(default)'} <span className="text-muted-foreground">{n}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium">2. Choose tables</p>
        </div>}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tables…" aria-label="Filter tables"
            className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {loading && <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading tables…</p>}
          {error && <p className="p-3 text-sm text-destructive">{error}</p>}
          {!loading && !error && shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">No tables found.</p>}
          {shown.map((i) => (
            <label key={i.name} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent">
              <Checkbox checked={picked.has(i.name)} onCheckedChange={() => toggle(i.name)} disabled={busy} aria-label={`Import ${i.name}`} />
              <span className="mono min-w-0 flex-1 truncate">{i.name}</span>
              {progress[i.name] === 'done' && <Check className="size-4 text-success" />}
              {progress[i.name] === 'running' && <Loader2 className="size-4 animate-spin" />}
              {progress[i.name] && !['pending', 'running', 'done'].includes(progress[i.name]) && <span className="max-w-48 truncate text-xs text-destructive" title={progress[i.name]}>{progress[i.name]}</span>}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{picked.size} selected{finished && !failed ? ' · done' : ''}</span>
          <div className="flex gap-2">
            <Button variant="ghost" label={finished ? 'Close' : 'Cancel'} onClick={onClose} isDisabled={busy} />
            <Button variant="primary" label={busy ? 'Working…' : `${mode === 'link' ? 'Link' : 'Copy'} ${picked.size || ''} table${picked.size === 1 ? '' : 's'}`.replace('  ', ' ')} onClick={run} isDisabled={busy || picked.size === 0} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
