import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ListChecks, Sparkles, Undo2, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { QbSpec } from './qbModel';

export interface AiResult { status: 'ok' | 'failed' | 'no_provider'; detail?: string; spec?: QbSpec; title?: string; explanation?: string; steps?: string[]; source?: 'rules' | 'ai'; attempts?: number }

/** Bold markers from the explanation text (**x**) rendered as <strong>. */
const rich = (t: string) => t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="font-mono text-xs">{p.slice(1, -1)}</code> : p));

/**
 * "Describe it" bar. Fresh request -> builds the steps; with a query already open the same box EDITS it ("only 2024", "add a running total").
 * Simple wording is understood instantly without a model; everything else goes to the AI. Undo restores the query from before.
 */
export function AiBar({ spec, onBuilt, onUndo, canUndo }: { spec: QbSpec; onBuilt: (s: QbSpec) => void; onUndo: () => void; canUndo: boolean }) {
  const table = spec.stages[0]?.table;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiResult | null>(null);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [open, setOpen] = useState(true);
  const ideas = useApi<{ suggestions: string[] }>(`/qb/ai/suggest${table ? `?table=${encodeURIComponent(table)}` : ''}`);

  const run = async (prompt = text) => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setRes(null); setSteps(null);
    try {
      const r = await api.post<AiResult>('/qb/ai/build', { prompt, spec: table ? spec : undefined });
      setRes(r);
      if (r.status === 'ok' && r.spec) { onBuilt(r.spec); setText(''); setOpen(true); }
    } catch (e) {
      setRes({ status: 'failed', detail: (e as Error).message });
    } finally { setBusy(false); }
  };
  const dismiss = () => { setRes(null); setSteps(null); };
  const explain = async () => {
    if (steps) return dismiss(); // second click closes the explanation
    setRes(null); setSteps((await api.post<{ steps: string[] }>('/qb/explain', { spec })).steps); setOpen(true);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <Input value={text} disabled={busy} aria-label="Describe what you want" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }} className="h-9 flex-1 bg-background"
          placeholder={table ? 'Change this query… e.g. only 2024, add a running total, top 5' : 'Describe what you want… e.g. total revenue by category'} />
        <Button size="sm" variant="primary" isDisabled={busy || !text.trim()} label={busy ? 'Working…' : table ? 'Update' : 'Build'} onClick={() => run()} />
      </div>

      {!res && !steps && !busy && (ideas.data?.suggestions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">Try:
          {ideas.data!.suggestions.slice(0, table ? 4 : 5).map((s) => <button key={s} type="button" onClick={() => run(s)} className="rounded-full border bg-card px-2 py-0.5 text-foreground hover:bg-accent">{s}</button>)}
        </div>
      )}
      {busy && <p className="text-xs text-muted-foreground">Reading your tables and building the steps… simple requests are instant; others ask the AI and can take a while.</p>}

      {res?.status === 'no_provider' && <p className="text-xs text-warning">No AI provider is set up. Simple requests still work; for the rest add one in <Link to="/settings" className="underline">Settings</Link> (a free Gemini key is enough).</p>}
      {res?.status === 'failed' && <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{res.detail}</p>}

      {(res?.status === 'ok' || steps) && (
        <div className="relative rounded-lg border bg-background/70 p-2.5 pr-8 text-sm">
          <button type="button" className="flex w-full items-center gap-1.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {res?.source === 'rules' ? <Zap className="size-3.5 text-warning" /> : <ListChecks className="size-3.5 text-primary" />}
            <span className="min-w-0 flex-1 truncate font-medium">{steps ? 'What this query does' : res?.title || 'Built'}</span>
            {res?.source && <span className="rounded-full bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">{res.source === 'rules' ? 'instant' : `AI${res.attempts && res.attempts > 1 ? ` · ${res.attempts} tries` : ''}`}</span>}
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          </button>
          <button type="button" aria-label="Close" onClick={dismiss} className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground hover:bg-accent"><X className="size-3.5" /></button>
          {open && (
            <ol className="mt-1.5 flex list-decimal flex-col gap-0.5 pl-5 text-xs text-muted-foreground marker:text-primary">
              {(steps ?? res?.steps ?? []).map((s, i) => <li key={i}>{rich(s)}</li>)}
            </ol>
          )}
          {res?.explanation && open && <p className="mt-1.5 text-xs italic text-muted-foreground">{res.explanation}</p>}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} label="Undo" isDisabled={!canUndo} onClick={() => { onUndo(); setRes(null); setSteps(null); }} />
        <Button size="sm" variant="ghost" icon={<ListChecks className="size-3.5" />} label={steps ? 'Hide explanation' : 'Explain this query'} isDisabled={!table} onClick={explain} />
      </div>
    </div>
  );
}
