import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { GenResult } from './useGenerateSession';

interface EditReply { status: string; detail?: string; message?: string; applied?: string[]; skipped?: { title: string; reason: string }[] }

/** Step 5: the dashboard is saved. Accept the AI's suggested improvements (or type your own) and open it. */
export function ResultCard({ result, onRestart }: { result: GenResult; onRestart: () => void }) {
  const [text, setText] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [apply, { busy, error }] = useAsyncAction(async (instruction: string) => {
    const r = await api.post<EditReply>(`/dashboards/${result.dashboard_id}/ai-edit`, { instruction });
    setLog((l) => [...l, r.status === 'ok' ? `${instruction} → ${r.message ?? 'done'}` : `${instruction} → ${r.detail ?? 'failed'}`]);
    setText('');
  });
  const done = new Set(log.map((l) => l.split(' → ')[0]));

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-4">
        <div className="animate-in zoom-in-95 fade-in rounded-lg border border-success/40 bg-success/10 p-3 duration-300">
          <p className="flex items-center gap-2 font-semibold text-success"><Check className="size-4" /> “{result.name}” is ready</p>
          <p className="text-sm text-muted-foreground">{result.widgets.length} widgets across {result.pages.join(', ')}.
            {result.skipped.length > 0 && ` ${result.skipped.length} skipped (${result.skipped.map((s) => s.title).join(', ')}).`}</p>
        </div>
        {result.suggestions.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-primary" /> The AI suggests improving it</p>
            <div className="flex flex-wrap gap-1.5">
              {result.suggestions.map((s) => (
                <button key={s} type="button" disabled={busy || done.has(s)} onClick={() => apply(s)}
                  className="rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-50">{done.has(s) ? '✓ ' : '+ '}{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1"><TextInput label="Ask the AI to change something" value={text} placeholder="e.g. add a chart of revenue by product category" onChange={setText} /></div>
          <Button variant="secondary" label={busy ? 'Working…' : 'Apply'} onClick={() => apply(text)} isDisabled={busy || !text.trim()} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {log.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" label="Start over" onClick={onRestart} />
          <Link to={`/dashboards/${result.dashboard_id}`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open dashboard</Link>
        </div>
      </div>
    </Card>
  );
}
