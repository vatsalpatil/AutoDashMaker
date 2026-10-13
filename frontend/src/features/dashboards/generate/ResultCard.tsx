import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { combineChanges } from './changes';
import type { GenResult } from './useGenerateSession';
import { ReviewChecklist } from '../ai/ReviewChecklist';
import { AiRunLog } from '../ai/AiRunLog';
import { useAiRun } from '../ai/useAiRun';

interface EditDone { message: string; applied: string[]; skipped: { title: string; reason: string }[] }
const EDIT_STEPS = ['Reading the dashboard', 'Planning the change', 'Applying and checking', 'Verifying the result'];

/** Step 5: the dashboard is saved. Tick any number of the AI's suggested improvements (and/or type your own) and apply them together, then open it. */
export function ResultCard({ result, onRestart }: { result: GenResult; onRestart: () => void }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<string[]>([]);
  const open = result.suggestions.filter((s) => !applied.has(s));
  const items = [...picked, ...(text.trim() ? [text.trim()] : [])];
  const flip = (s: string) => setPicked((p) => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  // streamed (live steps, never silent): a long non-streaming request is cut by the proxy after ~100 s (HTTP 524)
  const run = useAiRun<EditDone>();
  const busy = run.busy;
  const error = run.error?.message;
  const apply = async () => {
    const { done: r } = await run.run(`/api/dashboards/${result.dashboard_id}/ai-edit/stream`, { instruction: combineChanges(items) });
    if (!r) return;
    setApplied((a) => new Set([...a, ...picked]));
    setLog((l) => [...l, ...(r.applied.length ? r.applied : [r.message || 'Done'])]);
    if (r.skipped.length) setLog((l) => [...l, ...r.skipped.map((s) => `Skipped “${s.title}”: ${s.reason}`)]);
    setPicked(new Set());
    setText('');
  };

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-4">
        <div className="animate-in zoom-in-95 fade-in rounded-lg border border-success/40 bg-success/10 p-3 duration-300">
          <p className="flex items-center gap-2 font-semibold text-success"><Check className="size-4" /> “{result.name}” is ready</p>
          <p className="text-sm text-muted-foreground">{result.widgets.length} widgets across {result.pages.join(', ')}.
            {result.skipped.length > 0 && ` ${result.skipped.length} skipped (${result.skipped.map((s) => s.title).join(', ')}).`}</p>
        </div>
        {result.score !== undefined && result.checks && <ReviewChecklist score={result.score} checks={result.checks} />}
        {result.suggestions.length > 0 && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-primary" /> The AI suggests improving it — pick as many as you like</p>
              {open.length > 1 && (
                <span className="flex gap-3 text-xs text-primary">
                  <button type="button" onClick={() => setPicked(new Set(open))} disabled={busy}>Select all</button>
                  <button type="button" onClick={() => setPicked(new Set())} disabled={busy || picked.size === 0}>Clear</button>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested improvements">
              {result.suggestions.map((s) => {
                const done = applied.has(s);
                const on = picked.has(s);
                return (
                  <button key={s} type="button" aria-pressed={on} disabled={busy || done} onClick={() => flip(s)}
                    className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
                      on ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:border-primary hover:text-primary')}>
                    <span className={cn('flex size-3.5 items-center justify-center rounded-sm border', (on || done) && 'border-primary bg-primary text-primary-foreground')}>
                      {(on || done) && <Check className="size-3" />}
                    </span>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1"><TextInput label="Or ask the AI for something else" value={text} placeholder="e.g. add a chart of revenue by product category" onChange={setText} /></div>
          <Button variant="primary" label={busy ? 'Applying…' : items.length > 1 ? `Apply ${items.length} changes` : 'Apply'} onClick={() => apply()} isDisabled={busy || items.length === 0} />
        </div>
        {(busy || run.steps.length > 0) && <div className="rounded-lg border bg-muted/20 p-2"><AiRunLog run={run} titles={EDIT_STEPS} compact /></div>}
        {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        {log.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" label="Start over" onClick={onRestart} />
          <Link to={`/dashboards/${result.dashboard_id}`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open dashboard</Link>
        </div>
      </div>
    </Card>
  );
}
