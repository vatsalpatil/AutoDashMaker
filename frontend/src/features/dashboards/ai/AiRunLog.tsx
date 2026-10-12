import { AlertTriangle, Check, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, stepMs, totalMs, useTicker } from '../generate/timing';
import { LiveThinking } from '../generate/LiveThinking';
import { ReviewChecklist } from './ReviewChecklist';
import { WidgetRow } from './WidgetRow';
import type { AiRun } from './useAiRun';

type RunView = Pick<AiRun, 'steps' | 'live' | 'plan' | 'widgets' | 'ops' | 'review' | 'busy'>;

/** The AI's run, live: each phase with its timer and the model's thinking, the plan, every widget / change with its checks, then the self-review. */
export function AiRunLog({ run, titles, compact }: { run: RunView; titles: string[]; compact?: boolean }) {
  const now = useTicker(run.busy);
  if (!run.steps.length && !run.busy) return null;
  const byN = new Map(run.steps.map((s) => [s.n, s]));
  const nextN = Math.max(0, ...run.steps.filter((x) => x.done).map((x) => x.n)) + 1;
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-0.5">
        {titles.map((title, i) => {
          const n = i + 1;
          const s = byN.get(n);
          const done = !!s?.done;
          const running = run.busy && !done && (!!s || n === nextN);
          if (compact && !s && !running) return null;
          return (
            <li key={n} className={cn('flex gap-2.5 rounded-md p-1.5', running && 'bg-primary/5', !s && !running && 'opacity-45')}>
              <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                done ? 'border-success/40 bg-success/15 text-success' : running ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground')}>
                {done ? <Check className="size-3" /> : running ? <Loader2 className="size-3 animate-spin" /> : n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn('text-sm font-medium', running && 'gen-shimmer')}>{title}</p>
                  {s && <span className="tabular-nums text-[11px] text-muted-foreground">{formatDuration(stepMs(s, now))}</span>}
                </div>
                {s?.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                {running && run.live[n] && Object.entries(run.live[n]).map(([lane, t]) => <LiveThinking key={lane} reasoning={t.reasoning} answer={t.answer} />)}
              </div>
            </li>
          );
        })}
      </ol>
      {run.plan?.widgets && run.plan.widgets.length > 0 && !run.widgets.length && (
        <div className="rounded-md border bg-muted/30 p-2 text-xs">
          <p className="mb-1 font-medium">Plan: {run.plan.name}</p>
          <ul className="space-y-0.5">
            {run.plan.widgets.map((w) => <li key={w.title}><b>{w.title}</b> <span className="text-muted-foreground">({w.type}){w.why ? ` — ${w.why}` : ''}</span></li>)}
          </ul>
        </div>
      )}
      {run.widgets.length > 0 && <ul className="flex flex-col gap-1.5">{run.widgets.map((w, k) => <WidgetRow key={k} w={w} />)}</ul>}
      {run.ops.length > 0 && (
        <ul className="flex flex-col gap-1">
          {run.ops.map((o, k) => (
            <li key={k} className="flex items-start gap-1.5 text-xs animate-in fade-in duration-300">
              {o.op === 'retry' ? <RotateCw className="mt-0.5 size-3.5 shrink-0 text-primary" />
                : o.status === 'ok' ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />}
              <span>{o.text}{o.detail && <span className="text-muted-foreground"> — {o.detail}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {run.review && <ReviewChecklist score={run.review.score} checks={run.review.checks} compact={compact} />}
      {!run.busy && run.steps.length > 0 && <p className="text-right text-[11px] text-muted-foreground">AI time {formatDuration(totalMs(run.steps, now))}</p>}
    </div>
  );
}
