import { useEffect, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GenerationTimeline } from '../GenerationTimeline';
import { formatDuration, stepMs, useTicker } from './timing';
import type { GenStep, GenWidget, LiveLanes } from './useGenerateSession';

/** Claude-style "Thinking…" / "Worked for 17s" block for one AI turn: open while it runs, folds away when it finishes (click to reopen). */
export function ThinkingBlock({ label, steps, only, widgets = [], live, active }: {
  label: string; steps: GenStep[]; only: number[]; widgets?: GenWidget[]; live: LiveLanes; active: boolean;
}) {
  const mine = steps.filter((s) => only.includes(s.n));
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(active); }, [active]);
  const now = useTicker(active);
  const ms = mine.reduce((t, s) => t + stepMs(s, now), 0);
  const current = mine.find((s) => !s.done);

  return (
    <div className="rounded-xl border bg-card/60 shadow-sm backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
        <span className="relative flex size-6 items-center justify-center rounded-full bg-primary/10">
          {active && <span className="gen-ring absolute inset-0 rounded-full bg-primary/40" />}
          <Sparkles className="relative size-3.5 text-primary" />
        </span>
        <span className={cn('text-sm font-medium', active && 'gen-shimmer')}>
          {active ? (current?.title ?? label) : `${label} · worked for ${formatDuration(ms)}`}
        </span>
        {active && <span className="tabular-nums text-xs text-muted-foreground">{formatDuration(ms)}</span>}
        <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t px-2 py-2">
          <GenerationTimeline steps={steps} widgets={widgets} busy={active} live={live} only={only} />
        </div>
      )}
    </div>
  );
}
