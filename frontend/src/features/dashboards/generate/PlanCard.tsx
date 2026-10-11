import { useEffect, useState } from 'react';
import { Badge, Button, Card, TextArea } from '@/components/ui/kit';
import { Checkbox } from '@/components/ui/checkbox';
import type { Plan } from './useGenerateSession';

/** Step 3: the proposed pages and widgets. Untick what you do not want, or tell the AI what to change and it revises the plan. */
export function PlanCard({ plan, status, onRevise, onBuild }: { plan: Plan; status: 'idle' | 'revising' | 'building' | 'locked'; onRevise: (feedback: string) => void; onBuild: (keep: Set<number>) => void }) {
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState('');
  useEffect(() => { setKeep(new Set(plan.widgets.map((w) => w.idx))); setFeedback(''); }, [plan]);
  const busy = status !== 'idle';
  const flip = (i: number) => setKeep((k) => { const n = new Set(k); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">The plan: “{plan.name}”</h2>
          <p className="text-sm text-muted-foreground">{plan.pages.length} pages, {plan.widgets.length} widgets. Untick anything you do not want, or ask for changes.</p>
        </div>
        {plan.pages.map((p) => (
          <section key={p.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="mb-1.5 text-sm font-semibold">{p.name}</h3>
            <ul className="flex flex-col gap-1.5">
              {plan.widgets.filter((w) => w.page === p.id).map((w) => (
                <li key={w.idx} className="rounded-lg border bg-card p-2.5">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <Checkbox checked={keep.has(w.idx)} onCheckedChange={() => flip(w.idx)} aria-label={`Include ${w.title}`} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">{w.title}<Badge variant="neutral" label={w.type} /></span>
                      {w.why && <span className="block text-xs text-muted-foreground">{w.why}{w.formula ? ` — ${w.formula}` : ''}</span>}
                    </span>
                  </label>
                  <details className="ml-7 mt-1"><summary className="cursor-pointer text-xs text-primary">Query</summary><pre className="mono mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{w.sql}</pre></details>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <TextArea label="Want something different? Tell the AI" value={feedback} onChange={setFeedback} rows={2} placeholder="e.g. add a profit margin KPI, drop the pie chart, split regions by month" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" label={status === 'revising' ? 'Revising…' : 'Revise the plan'} onClick={() => onRevise(feedback)} isDisabled={busy || !feedback.trim()} />
          <Button variant="primary" label={status === 'building' ? 'Building…' : status === 'locked' ? 'Built' : `Build ${keep.size} widget${keep.size === 1 ? '' : 's'}`} onClick={() => onBuild(keep)} isDisabled={busy || keep.size === 0} />
        </div>
      </div>
    </Card>
  );
}
