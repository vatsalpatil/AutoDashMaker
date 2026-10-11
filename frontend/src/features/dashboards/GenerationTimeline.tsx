import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenStep, GenWidget } from './useGenerateDashboard';

/** The AI's process, top to bottom: what it read, understood, planned, built and checked. */
export function GenerationTimeline({ steps, widgets, busy }: { steps: GenStep[]; widgets: GenWidget[]; busy: boolean }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const running = !s.done && busy && i === steps.length - 1;
        return (
          <li key={s.n} className="flex gap-3">
            <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
              s.done ? 'border-success/40 bg-success/10 text-success' : 'border-primary/40 bg-primary/10 text-primary')}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : s.done ? <Check className="size-3.5" /> : s.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{s.n}. {s.title}</p>
              {s.detail && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.detail}</p>}
              {s.items && s.items.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{s.items.map((t, k) => <li key={k}>{t}</li>)}</ul>
              )}
              {s.n === 4 && widgets.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {widgets.map((w, k) => (
                    <li key={k} className="rounded-md border bg-card px-2.5 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        {w.status === 'ok' ? <Check className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
                        <span className="font-medium">{w.title}</span>
                        {w.status === 'ok' && <span className="text-xs text-muted-foreground">{w.chart} · {w.page}{w.ms ? ` · ${Math.round(w.ms)} ms` : ''}</span>}
                      </div>
                      {w.status === 'skipped' && <p className="mt-0.5 text-xs text-warning">Skipped: {w.detail}</p>}
                      {w.why && <p className="mt-0.5 text-xs text-muted-foreground">{w.why}{w.formula ? ` — ${w.formula}` : ''}</p>}
                      {w.sql && <details className="mt-0.5"><summary className="cursor-pointer text-xs text-primary">Query</summary><pre className="mono mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{w.sql}</pre></details>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
