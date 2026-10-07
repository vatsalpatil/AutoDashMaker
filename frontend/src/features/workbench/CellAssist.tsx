import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lightbulb, Loader2, Repeat, Sparkles, Square, Timer, Wand2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { AssistPanel, type Check, type Panel } from './AssistPanel';

interface AssistReply { status: string; detail?: string; sql?: string; text?: string; notes?: string[]; changed?: boolean }

const btn = 'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40';

/** AI + dialect helpers under a cell's editor: Fix (on error), Explain, Optimize, Convert. `onApply` writes SQL into the cell. */
export function CellAssist({ sql, error, cells, onApply }: {
  sql: string;
  error: string | null;
  cells: { name: string; sql: string }[];
  onApply: (sql: string) => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const dialects = useApi<{ dialects: { id: string; label: string }[] }>('/queries/dialects');
  const [busy, setBusy] = useState<string | null>(null);
  // live timer while a request runs, and how long the last one took (AI calls can take a minute on slow models)
  const [elapsed, setElapsed] = useState(0);
  const [took, setTook] = useState<string | null>(null);
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);
    return () => clearInterval(id);
  }, [busy]);
  const abort = useRef<AbortController | null>(null);
  const run = async (fn: (signal: AbortSignal) => Promise<void>, key: string) => {
    const t0 = Date.now();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(key);
    setTook(null);
    try { await fn(ctl.signal); } catch (e) {
      // Stop: the page stops waiting (the server may still finish its model call in the background).
      // Optimize / Explain keep their instant checks and show the error under them.
      const msg = ctl.signal.aborted ? 'Stopped.' : (e as Error).message;
      setPanel((p) => (p && (p.kind === 'explain' || p.kind === 'optimize') && p.checks.length > 0 ? { ...p, pending: false, error: msg } : { kind: 'info', text: msg }));
    } finally {
      abort.current = null;
      setTook(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
      setBusy(null);
    }
  };
  const empty = !sql.trim();

  const assist = (action: 'fix' | 'optimize' | 'explain') => run(async (signal) => {
    // rule-based checks are instant: show them straight away, the AI reply fills in below them
    let checks: Check[] = [];
    if (action !== 'fix') {
      checks = (await api.post<{ checks: Check[] }>('/queries/lint', { sql }, signal).catch(() => ({ checks: [] as Check[] }))).checks;
      setPanel(action === 'explain' ? { kind: 'explain', text: '', checks, pending: true } : { kind: 'optimize', sql: '', original: sql, notes: [], changed: false, checks, pending: true });
    }
    const r = await api.post<AssistReply>('/ai/assist', { action, sql, error: action === 'fix' ? error : undefined, cells }, signal);
    if (r.status === 'no_provider') return setPanel({ kind: 'info', text: r.detail ?? 'No AI provider connected — add one in Settings.' });
    if (action === 'fix') { onApply(r.sql!); setPanel({ kind: 'info', text: 'Applied the AI fix — run the cell again.' }); }
    else if (action === 'optimize') setPanel({ kind: 'optimize', sql: r.sql!, original: sql, notes: r.notes ?? [], changed: r.changed !== false, checks });
    else setPanel({ kind: 'explain', text: r.text ?? '', checks });
  }, 'ai-' + action);

  const convert = (to: string) => run(async (signal) => {
    const r = await api.post<{ sql: string; dialect: string }>('/queries/convert', { sql, to }, signal);
    setPanel({ kind: 'convert', sql: r.sql, dialect: r.dialect });
  }, 'convert');

  return (
    <div className="border-t border-border/60">
      <div className="flex flex-wrap items-center gap-1 px-3 py-1">
        {error && (
          <button type="button" className={`${btn} !text-destructive hover:!bg-destructive/10 dark:!text-destructive`} disabled={!!busy} onClick={() => assist('fix')}>
            {busy === 'ai-fix' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Fix with AI
          </button>
        )}
        <button type="button" className={btn} disabled={empty || !!busy} onClick={() => assist('explain')}>
          {busy === 'ai-explain' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />} Explain
        </button>
        <button type="button" className={btn} disabled={empty || !!busy} onClick={() => assist('optimize')}>
          {busy === 'ai-optimize' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Optimize
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Convert to dialect" disabled={empty || !!busy} className={btn} />}>
            {busy === 'convert' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />} Convert to… <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Rewrite this query for</DropdownMenuLabel>
              {dialects.data?.dialects.map((d) => <DropdownMenuItem key={d.id} onClick={() => convert(d.id)}>{d.label}</DropdownMenuItem>)}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {(busy || took) && (
          <span className="ml-auto flex items-center gap-1 px-1.5 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            <Timer className="h-3.5 w-3.5" />{busy ? `${elapsed.toFixed(1)} s` : `took ${took}`}
            {busy && (
              <button type="button" onClick={() => abort.current?.abort()} title="Stop" aria-label="Stop"
                className="ml-1 flex items-center gap-1 rounded-sm bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/20">
                <Square className="h-3 w-3 fill-current" /> Stop
              </button>
            )}
          </span>
        )}
      </div>

      {panel && <AssistPanel panel={panel} onApply={onApply} onClose={() => setPanel(null)} />}
    </div>
  );
}
