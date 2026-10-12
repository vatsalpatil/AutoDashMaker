import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { GenerateThread } from '@/features/dashboards/generate/GenerateThread';
import { PhaseStepper } from '@/features/dashboards/generate/PhaseStepper';
import { formatDuration, totalMs, useTicker } from '@/features/dashboards/generate/timing';
import { useGenerateSession } from '@/features/dashboards/generate/useGenerateSession';

/** AI dashboard session as a chat: a slim header (progress + AI time) over one conversation thread with a composer. */
export default function GenerateDashboardPage() {
  const [params] = useSearchParams();
  const s = useGenerateSession();
  const now = useTicker(s.busy);
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 9%, transparent), transparent 60%)' }}>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background/60 px-4 py-2 backdrop-blur">
        <Link to="/dashboards" className="text-muted-foreground hover:text-foreground" aria-label="Back to dashboards"><ArrowLeft className="size-4" /></Link>
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-6 items-center justify-center rounded-lg bg-primary/15">
            {s.busy && <span className="gen-ring absolute inset-0 rounded-lg bg-primary/30" />}<Sparkles className="relative size-3.5 text-primary" />
          </span>
          Generate with AI
        </h1>
        <div className="mx-auto hidden md:block"><PhaseStepper phase={s.phase} /></div>
        {s.steps.length > 0 && <span className="ml-auto rounded-full border px-2 py-0.5 text-xs tabular-nums text-muted-foreground md:ml-0" title="AI working time (waiting for you is not counted)">AI time {formatDuration(totalMs(s.steps, now))}</span>}
      </div>
      <div className="min-h-0 flex-1"><GenerateThread s={s} initialDataset={params.get('dataset') ?? undefined} /></div>
    </div>
  );
}
