import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, Hammer, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { Dataset } from '@/lib/types';
import { AiRunLog } from '../ai/AiRunLog';
import { useAiRun } from '../ai/useAiRun';
import { ActionChip, Composer } from './Composer';
import { PlanCard } from './PlanCard';
import { ResultCard } from './ResultCard';
import { SetupCard } from './SetupCard';
import { ThinkingBlock } from './ThinkingBlock';
import { UnderstandingCard } from './UnderstandingCard';
import type { Setup, useGenerateSession } from './useGenerateSession';

type Session = ReturnType<typeof useGenerateSession>;
interface FollowUp { text: string; log?: ReturnType<typeof snapshot>; error?: string; message?: string }
const EDIT_STEPS = ['Reading the dashboard', 'Planning the change', 'Applying and checking', 'Verifying the result'];
const snapshot = (r: ReturnType<typeof useAiRun<unknown>>) => ({ steps: r.steps, live: {}, plan: r.plan, widgets: r.widgets, ops: r.ops, review: r.review, busy: false });

const You = ({ children }: { children: ReactNode }) => (
  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary/90 px-4 py-2 text-sm text-primary-foreground shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>
);
const Ai = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-3 animate-in fade-in duration-300">{children}</div>;

/** The whole AI dashboard session as one conversation: your choices and messages, the AI's thinking (folds away when done), its cards, and follow-up edits. */
export function GenerateThread({ s, initialDataset }: { s: Session; initialDataset?: string }) {
  const datasets = useApi<Dataset[]>('/datasets').data ?? [];
  const draft = useRef<Setup | null>(null);
  const answers = useRef<Record<string, string>>({});
  const [revisions, setRevisions] = useState<string[]>([]);
  const [follow, setFollow] = useState<FollowUp[]>([]);
  const edit = useAiRun<{ message: string; applied: string[] }>();
  const scroll = useStickToBottom();
  const onDraft = useCallback((d: Setup) => { draft.current = d; }, []);
  const onAnswers = useCallback((a: Record<string, string>) => { answers.current = a; }, []);
  const phase = s.phase;
  const answered = Object.entries(s.answers).filter(([k]) => k !== 'notes');

  async function send(text: string) {
    scroll.jump();
    if (phase === 'setup' && draft.current) { setRevisions([]); setFollow([]); s.start({ ...draft.current, focus: text }); }
    else if (phase === 'questions') s.makePlan({ ...answers.current, ...(text ? { notes: [answers.current.notes, text].filter(Boolean).join('; ') } : {}) });
    else if (phase === 'plan') { setRevisions((r) => [...r, text]); s.makePlan(s.answers, text); }
    else if (phase === 'done' && s.result) {
      setFollow((f) => [...f.map((x, i) => (i === f.length - 1 ? { ...x, log: snapshot(edit) } : x)), { text }]);   // freeze the previous turn's log
      const r = await edit.run(`/api/dashboards/${s.result.dashboard_id}/ai-edit/stream`, { instruction: text, page: undefined,
        history: follow.map((f) => ({ role: 'user', text: f.text })) });
      setFollow((f) => f.map((x, i) => (i === f.length - 1 ? { ...x, error: r.error?.message, message: r.done?.message } : x)));
    }
  }

  const composer = {
    setup: { placeholder: 'Anything to focus on? e.g. profit by region, weakest months… (optional)', sendLabel: 'Start', allowEmpty: true, hint: 'Pick a dataset and template above, then start' },
    understanding: { placeholder: 'The AI is studying your data…', hint: 'Reading statistics, top rows and correlations' },
    questions: { placeholder: 'Add notes for the AI (optional), or just send to plan', sendLabel: 'Plan', allowEmpty: true, hint: 'Pick answers above — every question takes several' },
    planning: { placeholder: 'The AI is planning…', hint: 'One model call per page, in parallel' },
    plan: { placeholder: 'Ask for changes to the plan: add a margin KPI, drop the pie…', sendLabel: 'Revise', hint: 'Or untick widgets above and build' },
    building: { placeholder: 'Building and checking every widget…', hint: 'Validated read-only, repaired, self-reviewed' },
    done: { placeholder: 'Keep editing the dashboard: add a chart, move the KPIs, add a page…', sendLabel: 'Apply', hint: 'Each change is checked; undo is in the dashboard’s Edit with AI panel' },
  }[phase];
  const actions = <>
    {phase === 'questions' && <ActionChip label="Skip questions" icon={<SkipForward className="size-3.5" />} onClick={() => s.makePlan({})} />}
    {phase === 'plan' && s.plan && <ActionChip label={`Build all ${s.plan.widgets.length} widgets`} icon={<Hammer className="size-3.5" />} onClick={() => s.build(new Set(s.plan!.widgets.map((w) => w.idx)))} />}
    {phase !== 'setup' && !s.busy && <ActionChip label="New session" icon={<RotateCcw className="size-3.5" />} onClick={() => { setRevisions([]); setFollow([]); s.restart(); }} />}
    {phase === 'done' && s.result && <Link to={`/dashboards/${s.result.dashboard_id}`} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Open dashboard</Link>}
  </>;

  const ds = datasets.find((d) => d.id === s.setup?.dataset_id);
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div ref={scroll.ref} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={scroll.contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
          <Ai>
            <p className="flex items-center gap-2 text-sm"><Sparkles className="size-4 text-primary" />
              Hi! Pick the data and a style. I’ll study it, ask what matters to you, propose a plan you can edit, then build and check every widget.</p>
            <SetupCard initialDataset={initialDataset} locked={s.setup} onStart={s.start} onDraft={onDraft} />
          </Ai>
          {s.setup && <You><b>{ds?.name ?? 'Dataset'}</b> · {s.setup.template === 'auto' ? 'Best fit' : s.setup.template}{s.setup.focus ? ` — ${s.setup.focus}` : ''}</You>}
          {s.setup && (
            <Ai>
              <ThinkingBlock label="Studied the data" steps={s.steps} only={[1, 2]} live={s.live} active={phase === 'understanding'} />
              {(s.evidence || s.understanding) && <UnderstandingCard evidence={s.evidence} understanding={s.understanding} busy={phase !== 'questions'} onContinue={(a) => s.makePlan(a)} onAnswers={onAnswers} />}
            </Ai>
          )}
          {s.plan || phase === 'planning' ? <You>{answered.length ? `Answered ${answered.length} question(s)` : 'Go ahead with your best judgement'}{s.answers.notes ? ` — ${s.answers.notes}` : ''}</You> : null}
          {revisions.map((r, i) => <You key={i}>{r}</You>)}
          {(s.plan || phase === 'planning') && (
            <Ai>
              <ThinkingBlock label="Planned the dashboard" steps={s.steps} only={[3]} live={s.live} active={phase === 'planning'} />
              {s.plan && phase !== 'planning' && (
                <PlanCard plan={s.plan} status={phase === 'building' ? 'building' : phase === 'done' ? 'locked' : 'idle'}
                  onRevise={(f) => { setRevisions((r) => [...r, f]); s.makePlan(s.answers, f); }} onBuild={s.build} />
              )}
            </Ai>
          )}
          {(phase === 'building' || phase === 'done') && (
            <Ai>
              <ThinkingBlock label="Built and checked" steps={s.steps} only={[4, 5, 6]} widgets={s.widgets} live={s.live} active={phase === 'building'} />
              {s.result && phase === 'done' && <ResultCard result={s.result} onRestart={() => { setRevisions([]); setFollow([]); s.restart(); }} />}
            </Ai>
          )}
          {follow.map((f, i) => (
            <div key={i} className="flex flex-col gap-3">
              <You>{f.text}</You>
              <Ai>
                <div className="rounded-xl border bg-card/60 p-2">
                  <AiRunLog run={i === follow.length - 1 ? edit : (f.log ?? snapshot(edit))} titles={EDIT_STEPS} compact />
                </div>
                {f.error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{f.error}</p>}
                {f.message && <p className="text-sm">{f.message}</p>}
              </Ai>
            </div>
          ))}
          {s.error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {s.error.noProvider ? <>No AI provider is set up. Add one in <Link to="/settings" className="underline">Settings</Link>.</> : s.error.message}
            </p>
          )}
        </div>
      </div>
      {!scroll.atBottom && (
        <button type="button" onClick={() => scroll.jump()} aria-label="Jump to latest"
          className="absolute bottom-36 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs shadow-md">
          <ArrowDown className="size-3.5" /> Latest
        </button>
      )}
      <div className="bg-gradient-to-t from-background via-background/95 to-transparent pt-4">
        <Composer {...composer} busy={s.busy || edit.busy} onStop={() => { s.stop(); edit.stop(); }} onSend={send} actions={actions} />
      </div>
    </div>
  );
}
