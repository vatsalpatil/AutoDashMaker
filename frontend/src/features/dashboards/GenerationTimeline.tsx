import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, stepMs, useTicker } from './generate/timing';
import { LiveThinking } from './generate/LiveThinking';
import type { GenStep, GenWidget, LiveLanes } from './generate/useGenerateSession';

export const STEP_TITLES = ['Reading the data', 'Understanding the data', 'Planning the dashboard', 'Building and checking each widget', 'Writing insights', 'Saving the dashboard'];
const ENTER = 'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both';

/** The AI's process, top to bottom: all steps are listed up front; the active one pulses, finished ones turn green, pending ones wait dimmed. */
export function GenerationTimeline({ steps, widgets, busy, live = {} }: { steps: GenStep[]; widgets: GenWidget[]; busy: boolean; live?: LiveLanes }) {
  const now = useTicker(busy);
  const byN = new Map(steps.map((s) => [s.n, s]));
  const nextN = Math.max(0, ...steps.filter((x) => x.done).map((x) => x.n)) + 1;   // the step waiting to start
  return (
    <ol className="flex flex-col gap-1">
      {STEP_TITLES.map((title, i) => {
        const n = i + 1;
        const s = byN.get(n);
        const done = !!s?.done;
        const running = busy && !done && (!!s || n === nextN);
        const pending = !s && !running;
        return (
          <li key={n} className={cn('flex gap-3 rounded-lg p-2 transition-colors', running && 'bg-primary/5', s && ENTER, pending && 'opacity-45')}>
            <span className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center">
              {running && <span className="gen-ring absolute inset-0 rounded-full bg-primary/40" />}
              <span className={cn('relative flex size-6 items-center justify-center rounded-full border text-xs transition-colors duration-300',
                done ? 'border-success/40 bg-success/15 text-success' : running ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground')}>
                {done ? <Check className="size-3.5 animate-in zoom-in-50 duration-300" /> : running ? <Loader2 className="size-3.5 animate-spin" /> : n}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn('text-sm font-semibold', running && 'gen-shimmer')}>{title}</p>
                {s && (s.done || running || s.spentMs > 0) && <span className={cn('tabular-nums text-xs', running ? 'text-primary' : 'text-muted-foreground')}>{formatDuration(stepMs(s, now))}</span>}
              </div>
              {s?.detail && <p className={cn('whitespace-pre-line text-sm text-muted-foreground', ENTER)}>{s.detail}</p>}
              {running && live[n] && Object.entries(live[n]).map(([lane, t]) => <LiveThinking key={lane} label={Object.keys(live[n]).length > 1 ? t.label : undefined} reasoning={t.reasoning} answer={t.answer} />)}
              {s?.items && s.items.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {s.items.map((t, k) => <li key={k} className={ENTER} style={{ animationDelay: `${Math.min(k, 12) * 60}ms` }}>{t}</li>)}
                </ul>
              )}
              {n === 4 && widgets.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {widgets.map((w, k) => (
                    <li key={k} className={cn('rounded-md border bg-card px-2.5 py-1.5 text-sm', ENTER)}>
                      <div className="flex items-center gap-2">
                        {w.status === 'ok' ? <Check className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
                        <span className="font-medium">{w.title}</span>
                        {w.status === 'ok' && <span className="text-xs text-muted-foreground">{w.chart} · {w.page}{w.ms ? ` · ${Math.round(w.ms)} ms` : ''}</span>}
                        {w.fixed ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title="The first query failed; the AI repaired it automatically">auto-fixed ×{w.fixed}</span> : null}
                      </div>
                      {w.status === 'skipped' && <p className="mt-0.5 text-xs text-warning">Skipped: {w.detail}</p>}
                      {w.why && <p className="mt-0.5 text-xs text-muted-foreground">{w.why}{w.formula ? ` — ${w.formula}` : ''}</p>}
                      {w.sql && <details className="mt-0.5"><summary className="cursor-pointer text-xs text-primary">Query</summary><pre className="mono mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{w.sql}</pre></details>}
                    </li>
                  ))}
                </ul>
              )}
              {running && !s?.detail && <div className="mt-1.5 flex flex-col gap-1.5" aria-hidden><div className="h-2.5 w-3/4 animate-pulse rounded bg-muted" /><div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" /></div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
