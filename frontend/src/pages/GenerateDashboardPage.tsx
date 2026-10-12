import { useSearchParams } from 'react-router-dom';
import { GenerateThread } from '@/features/dashboards/generate/GenerateThread';
import { PhaseStepper } from '@/features/dashboards/generate/PhaseStepper';
import { formatDuration, totalMs, useTicker } from '@/features/dashboards/generate/timing';
import { useGenerateSession } from '@/features/dashboards/generate/useGenerateSession';

/** AI dashboard session as a chat: a slim progress strip (the app bar already shows the title) over one conversation thread with a composer. */
export default function GenerateDashboardPage() {
  const [params] = useSearchParams();
  const s = useGenerateSession();
  const now = useTicker(s.busy);
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 9%, transparent), transparent 60%)' }}>
      <div className="flex shrink-0 items-center justify-center gap-3 border-b bg-background/60 px-4 py-1.5 backdrop-blur">
        <PhaseStepper phase={s.phase} />
        {s.steps.length > 0 && <span className="rounded-full border px-2 py-0.5 text-xs tabular-nums text-muted-foreground" title="AI working time (waiting for you is not counted)">AI time {formatDuration(totalMs(s.steps, now))}</span>}
      </div>
      <div className="min-h-0 flex-1"><GenerateThread s={s} initialDataset={params.get('dataset') ?? undefined} /></div>
    </div>
  );
}
