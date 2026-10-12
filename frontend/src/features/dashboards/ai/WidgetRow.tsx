import { AlertTriangle, Check, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenWidget } from '../generate/useGenerateSession';

const ENTER = 'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both';

/** One widget the AI built: status, chart type, timing, repairs, self-review corrections, the reason it exists and its query. */
export function WidgetRow({ w }: { w: GenWidget }) {
  return (
    <li className={cn('rounded-md border bg-card px-2.5 py-1.5 text-sm', ENTER)}>
      <div className="flex flex-wrap items-center gap-2">
        {w.status === 'ok' ? <Check className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
        <span className="font-medium">{w.title}</span>
        {w.replacement && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">replacement</span>}
        {w.status === 'ok' && <span className="text-xs text-muted-foreground">{[w.chart, w.page, w.ms ? `${Math.round(w.ms)} ms` : ''].filter(Boolean).join(' · ')}</span>}
        {w.fixed ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title="The first query failed; the AI repaired it automatically">auto-fixed ×{w.fixed}</span> : null}
      </div>
      {w.status === 'skipped' && <p className="mt-0.5 text-xs text-warning">Skipped: {w.detail}</p>}
      {w.notes?.map((n) => <p key={n} className="mt-0.5 flex items-center gap-1 text-xs text-primary"><Wand2 className="size-3 shrink-0" />Self-review: {n}</p>)}
      {w.why && <p className="mt-0.5 text-xs text-muted-foreground">{w.why}{w.formula ? ` — ${w.formula}` : ''}</p>}
      {w.sql && <details className="mt-0.5"><summary className="cursor-pointer text-xs text-primary">Query</summary><pre className="mono mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{w.sql}</pre></details>}
    </li>
  );
}
