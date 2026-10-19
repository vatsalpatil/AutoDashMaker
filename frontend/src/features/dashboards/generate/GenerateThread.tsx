import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, Hammer, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useApi } from '@/hooks/useApi';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { Dataset } from '@/lib/types';
import { AiRunLog } from '../ai/AiRunLog';
import { useAiRun } from '../ai/useAiRun';
import { ActionChip, Composer } from './Composer';
import { MessageImages } from '@/features/ai/attachments/Attachments';
import { SessionHistory } from '@/features/ai/history/SessionHistory';
import { useAiSessions } from '@/features/ai/history/useAiSessions';
import { PlanCard } from './PlanCard';
import { ResultCard } from './ResultCard';
import { SetupCard } from './SetupCard';
import { SessionPanel } from './SessionPanel';
import { ThinkingBlock } from './ThinkingBlock';
import { UnderstandingCard } from './UnderstandingCard';
import type { SavedGen, Setup, useGenerateSession } from './useGenerateSession';

type Session = ReturnType<typeof useGenerateSession>;
interface SavedThread extends SavedGen { revisions: { text: string; images: string[] }[]; follow: { text: string; images?: string[]; message?: string; error?: string }[]; notesImages: string[] }
const PHASE_LABEL: Record<string, string> = { setup: 'not started', understanding: 'studying data', questions: 'waiting for your answers', planning: 'planning', plan: 'plan ready', building: 'building', done: 'dashboard built' };
interface FollowUp { text: string; images?: string[]; log?: ReturnType<typeof snapshot>; error?: string; message?: string }
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
  const [revisions, setRevisions] = useState<{ text: string; images: string[] }[]>([]);
  const [notesImages, setNotesImages] = useState<string[]>([]);
  const [follow, setFollow] = useState<FollowUp[]>([]);
  const edit = useAiRun<{ message: string; applied: string[] }>();
  const scroll = useStickToBottom();
  const history = useAiSessions<SavedThread>('generate');
  const dsName = datasets.find((d) => d.id === s.setup?.dataset_id)?.name;
  // autosave the conversation whenever it settles (not on every streamed token)
  useEffect(() => {
    if (s.busy || !s.setup) return;
    const state: SavedThread = { ...s.snapshot(), revisions, notesImages, follow: follow.map(({ text, images, message, error }) => ({ text, images, message, error })) };
    history.autosave(state, s.result?.name ?? s.plan?.name ?? `${dsName ?? 'Dashboard'} — AI session`, PHASE_LABEL[s.phase] ?? s.phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.busy, s.phase, s.plan, s.result, s.answers, revisions, follow, notesImages]);
  async function openSaved(id: string) {
    const v = await history.open(id);
    if (!v) return;
    s.restore(v); setRevisions(v.revisions ?? []); setFollow(v.follow ?? []); setNotesImages(v.notesImages ?? []);
    scroll.jump(false);
  }
  const newChat = () => { history.startNew(); setRevisions([]); setFollow([]); setNotesImages([]); s.restart(); };
  const onDraft = useCallback((d: Setup) => { draft.current = d; }, []);
  const onAnswers = useCallback((a: Record<string, string>) => { answers.current = a; }, []);
  const phase = s.phase;
  const answered = Object.entries(s.answers).filter(([k]) => k !== 'notes');

  async function send(text: string, images: string[] = []) {
    scroll.jump();
    if (phase === 'setup' && draft.current) { setRevisions([]); setFollow([]); setNotesImages([]); s.start({ ...draft.current, focus: text, images }); }
    else if (phase === 'questions') {
      setNotesImages(images);
      s.makePlan({ ...answers.current, ...(text ? { notes: [answers.current.notes, text].filter(Boolean).join('; ') } : {}) }, '', images);
    }
    else if (phase === 'plan') { setRevisions((r) => [...r, { text, images }]); s.makePlan(s.answers, text || 'Use the attached image(s).', images); }
    else if (phase === 'done' && s.result) {
      setFollow((f) => [...f.map((x, i) => (i === f.length - 1 ? { ...x, log: snapshot(edit) } : x)), { text, images }]);   // freeze the previous turn's log
      const r = await edit.run(`/api/dashboards/${s.result.dashboard_id}/ai-edit/stream`, { instruction: text || 'Apply what the attached image(s) show.', images, page: undefined,
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
    <SessionHistory h={history} busy={s.busy || edit.busy} onOpen={openSaved} onNew={newChat} />
    {phase === 'questions' && <ActionChip label="Skip questions" icon={<SkipForward className="size-3.5" />} onClick={() => s.makePlan({})} />}
    {phase === 'plan' && s.plan && <ActionChip label={`Build all ${s.plan.widgets.length} widgets`} icon={<Hammer className="size-3.5" />} onClick={() => s.build(new Set(s.plan!.widgets.map((w) => w.idx)))} />}
    {phase !== 'setup' && !s.busy && <ActionChip label="New session" icon={<RotateCcw className="size-3.5" />} onClick={newChat} />}
    {phase === 'done' && s.result && <Link to={`/dashboards/${s.result.dashboard_id}`} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Open dashboard</Link>}
  </>;

  const ds = datasets.find((d) => d.id === s.setup?.dataset_id);
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
    <ResizablePanel minSize={380}>
    <div className="relative flex h-full min-w-0 flex-col">
      <div ref={scroll.ref} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={scroll.contentRef} className="flex w-full flex-col gap-5 px-4 py-6 lg:px-6">
          <Ai>
            <p className="flex items-center gap-2 text-sm"><Sparkles className="size-4 text-primary" />
              Hi! Pick the data and a style. I’ll study it, ask what matters to you, propose a plan you can edit, then build and check every widget.</p>
            <SetupCard initialDataset={initialDataset} locked={s.setup} onStart={s.start} onDraft={onDraft} />
          </Ai>
          {s.setup && <You><MessageImages images={s.setup.images} className="mb-1.5" /><b>{ds?.name ?? 'Dataset'}</b> · {s.setup.template === 'auto' ? 'Best fit' : s.setup.template}{s.setup.focus ? ` — ${s.setup.focus}` : ''}</You>}
          {s.setup && (
            <Ai>
              <ThinkingBlock label="Studied the data" steps={s.steps} only={[1, 2]} live={s.live} active={phase === 'understanding'} />
              {(s.evidence || s.understanding) && <UnderstandingCard evidence={s.evidence} understanding={s.understanding} busy={phase !== 'questions'} onContinue={(a) => s.makePlan(a)} onAnswers={onAnswers} />}
            </Ai>
          )}
          {s.plan || phase === 'planning' ? <You>{answered.length ? `Answered ${answered.length} question(s)` : 'Go ahead with your best judgement'}{s.answers.notes ? ` — ${s.answers.notes}` : ''}<MessageImages images={notesImages} className="mt-1.5" /></You> : null}
          {revisions.map((r, i) => <You key={i}><MessageImages images={r.images} className="mb-1.5" />{r.text}</You>)}
          {(s.plan || phase === 'planning') && (
            <Ai>
              <ThinkingBlock label="Planned the dashboard" steps={s.steps} only={[3]} live={s.live} active={phase === 'planning'} />
              {s.plan && phase !== 'planning' && (
                <PlanCard plan={s.plan} status={phase === 'building' ? 'building' : phase === 'done' ? 'locked' : 'idle'}
                  onRevise={(f) => { setRevisions((r) => [...r, { text: f, images: [] }]); s.makePlan(s.answers, f); }} onBuild={s.build} />
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
              <You><MessageImages images={f.images} className="mb-1.5" />{f.text}</You>
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
    </ResizablePanel>
    <ResizableHandle withHandle />
    {/* drag to resize the progress panel; drag fully right to tuck it away */}
    <ResizablePanel defaultSize="26" minSize={240} maxSize="55" collapsible collapsedSize={0}>
      <SessionPanel s={s} datasetName={ds?.name} />
    </ResizablePanel>
    </ResizablePanelGroup>
  );
}
