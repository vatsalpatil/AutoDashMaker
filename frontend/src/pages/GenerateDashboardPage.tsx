import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/kit';
import { GenerationTimeline } from '@/features/dashboards/GenerationTimeline';
import { PhaseStepper } from '@/features/dashboards/generate/PhaseStepper';
import { PlanCard } from '@/features/dashboards/generate/PlanCard';
import { ResultCard } from '@/features/dashboards/generate/ResultCard';
import { SetupCard } from '@/features/dashboards/generate/SetupCard';
import { UnderstandingCard } from '@/features/dashboards/generate/UnderstandingCard';
import { formatDuration, totalMs, useTicker } from '@/features/dashboards/generate/timing';
import { useGenerateSession } from '@/features/dashboards/generate/useGenerateSession';

/** AI dashboard session as a page: set up, the AI studies the data and asks you questions, you approve a plan, it builds and checks everything. */
export default function GenerateDashboardPage() {
  const [params] = useSearchParams();
  const s = useGenerateSession();
  const now = useTicker(s.busy);
  // bring the card that needs your attention into view whenever the session moves on
  useEffect(() => {
    const id = { questions: 'gen-questions', plan: 'gen-plan', done: 'gen-result' }[s.phase as 'questions' | 'plan' | 'done'];
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [s.phase]);
  const showUnderstanding = s.evidence || s.understanding;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Generate a dashboard with AI" description="The AI studies your data, asks for your input, shows its plan, and builds only what passes its own checks."
        actions={<Link to="/dashboards" className="text-sm text-muted-foreground hover:text-foreground">← Dashboards</Link>} />
      <PhaseStepper phase={s.phase} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SetupCard initialDataset={params.get('dataset') ?? undefined} locked={s.setup} onStart={s.start} />
          {showUnderstanding && <div id="gen-questions" className="scroll-mt-4"><UnderstandingCard evidence={s.evidence} understanding={s.understanding} busy={s.phase !== 'questions'} onContinue={(a) => s.makePlan(a)} /></div>}
          {s.plan && s.phase !== 'questions' && s.phase !== 'understanding' && <div id="gen-plan" className="scroll-mt-4"><PlanCard plan={s.plan} status={s.phase === 'planning' ? 'revising' : s.phase === 'building' ? 'building' : s.phase === 'done' ? 'locked' : 'idle'} onRevise={(f) => s.makePlan(s.answers, f)} onBuild={s.build} /></div>}
          {s.result && s.phase === 'done' && <div id="gen-result" className="scroll-mt-4"><ResultCard result={s.result} onRestart={s.restart} /></div>}
          {s.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {s.error.noProvider ? <>No AI provider is set up. Add one in <Link to="/settings" className="underline">Settings</Link> to generate dashboards.</> : s.error.message}
            </p>
          )}
          {s.busy && <div><Button variant="secondary" label="Stop" onClick={s.stop} /></div>}
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="relative flex size-5 items-center justify-center">{s.busy && <span className="gen-ring absolute inset-0 rounded-full bg-primary/40" />}<Sparkles className="relative size-4 text-primary" /></span>
              How the AI is working
              {s.steps.length > 0 && <span className="ml-auto rounded-full border px-2 py-0.5 text-xs font-normal tabular-nums text-muted-foreground" title="Total AI working time (waiting for your answers is not counted)">Total {formatDuration(totalMs(s.steps, now))}</span>}
            </h2>
            {s.steps.length === 0 && !s.busy ? <p className="text-sm text-muted-foreground">Its steps will appear here as it works.</p>
              : <div className="max-h-[calc(100svh-10rem)] overflow-y-auto"><GenerationTimeline steps={s.steps} widgets={s.widgets} busy={s.busy} live={s.live} /></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
