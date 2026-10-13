import { useCallback, useRef, useState } from 'react';
import { streamPost } from '@/lib/sse';
import type { ReviewCheck } from '../ai/ReviewChecklist';
import { applyStep, applyThink, stopSteps, type StepEvent, type ThinkEvent } from './streamState';

/** `spentMs` = finished time on this step; `startedAt` = when its current run began (unset when not running). */
export interface GenStep { n: number; title: string; detail: string; items?: string[]; done: boolean; spentMs: number; startedAt?: number }
export interface GenWidget { title: string; status: 'ok' | 'skipped'; detail?: string; page?: string; chart?: string; ms?: number | null; fixed?: number; why?: string; formula?: string; sql?: string; notes?: string[]; replacement?: boolean }
export interface DescribeRow { column: string; type: string; role: string; empty_pct: number; distinct: number; min: unknown; p25: unknown; median: unknown; p75: unknown; max: unknown; mean: unknown; std: unknown }
export interface Evidence { table: string; rows: number; describe: DescribeRow[]; sample: { columns: string[]; rows: Record<string, unknown>[] }; correlations: { a: string; b: string; r: number }[] }
export interface Question { id: string; question: string; why: string; options: string[]; multi: boolean }
export interface Understanding { understanding: string; thinking: string[]; questions: Question[]; ideas: string[] }
export interface PlanWidget { idx: number; page: string; title: string; type: string; why: string; formula: string; sql: string }
export interface Plan { name: string; pages: { id: string; name: string }[]; widgets: PlanWidget[] }
export interface GenResult { dashboard_id: string; name: string; pages: string[]; widgets: { title: string; type: string; page: string }[]; skipped: { title: string; reason: string }[]; suggestions: string[]; score?: number; checks?: ReviewCheck[] }
export interface LiveText { reasoning: string; answer: string; label: string }
/** step number -> lane (one per parallel model call, e.g. one per page) -> that call's streaming text */
export type LiveLanes = Record<number, Record<string, LiveText>>
export interface Setup { dataset_id: string; template: string; focus: string; images?: string[] }
/** setup -> understand (AI studies the data) -> questions (you answer) -> plan (you review) -> build -> done */
export type Phase = 'setup' | 'understanding' | 'questions' | 'planning' | 'plan' | 'building' | 'done';

type Ev =
  | StepEvent
  | ({ type: 'profile' } & Evidence)
  | ({ type: 'understanding' } & Understanding)
  | ({ type: 'plan' } & Plan)
  | ({ type: 'widget' } & GenWidget)
  | ThinkEvent
  | { type: 'review'; score: number; checks: ReviewCheck[] }
  | ({ type: 'done' } & GenResult)
  | { type: 'error'; kind?: string; message: string };

const BASE = '/api/dashboards/generate';

/** Everything needed to reopen a session later (saved chat history). */
export interface SavedGen { phase: Phase; setup: Setup | null; steps: GenStep[]; evidence: Evidence | null; understanding: Understanding | null;
  answers: Record<string, string>; plan: Plan | null; widgets: GenWidget[]; result: GenResult | null }
/** A phase that was still running when saved reopens at the point where the user can act again. */
const SETTLED: Partial<Record<Phase, (v: SavedGen) => Phase>> = {
  understanding: () => 'setup', planning: (v) => (v.plan ? 'plan' : v.understanding ? 'questions' : 'setup'), building: () => 'plan',
};

/** The whole interactive generation: three streamed AI phases with a pause for the user after the first two. */
export function useGenerateSession() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [steps, setSteps] = useState<GenStep[]>([]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [widgets, setWidgets] = useState<GenWidget[]>([]);
  const [live, setLive] = useState<LiveLanes>({});   // per step and lane: the model's streaming thinking + answer
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<{ message: string; noProvider: boolean } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = phase === 'understanding' || phase === 'planning' || phase === 'building';

  const handle = useCallback((ev: Ev) => {
    if (ev.type === 'step') {
      if (ev.done) setLive((l) => { const { [ev.n]: _gone, ...rest } = l; return rest; });   // the finished step shows its result instead
      setSteps((st) => applyStep(st, ev, Date.now()));
    } else if (ev.type === 'think') {
      setLive((l) => applyThink(l, ev));
    } else if (ev.type === 'profile') { const { type: _t, ...e } = ev; setEvidence(e); }
    else if (ev.type === 'understanding') { const { type: _t, ...u } = ev; setUnderstanding(u); setPhase('questions'); }
    else if (ev.type === 'plan') { const { type: _t, ...p } = ev; setPlan(p); setPhase('plan'); }
    else if (ev.type === 'widget') { const { type: _t, ...w } = ev; setWidgets((ws) => [...ws, w]); }
    else if (ev.type === 'review') { /* shown from the final result */ }
    else if (ev.type === 'done') { const { type: _t, ...r } = ev; setResult(r); setPhase('done'); }
    else { setError({ message: ev.message, noProvider: ev.kind === 'no_provider' }); }
  }, []);

  /** Run one phase; an error event or a failed request returns to `back` so the user can retry. */
  const run = useCallback(async (path: string, body: unknown, during: Phase, back: Phase) => {
    setError(null);
    setLive({});
    setPhase(during);
    abort.current = new AbortController();
    let failed = false;
    try {
      await streamPost<Ev>(path, body, (ev) => { if (ev.type === 'error') failed = true; handle(ev); }, abort.current.signal);
    } catch (e) {
      failed = true;
      if ((e as Error).name !== 'AbortError') setError({ message: (e as Error).message, noProvider: false });
    }
    if (failed) {
      const now = Date.now();   // freeze the timers of whatever was running, and drop the stale 'studying…' text
      setSteps((st) => stopSteps(st, now));
      setLive({});
      setPhase(back);
    }
    return failed;
  }, [handle]);

  const start = useCallback((s: Setup) => {
    setSetup(s); setSteps([]); setEvidence(null); setUnderstanding(null); setAnswers({}); setPlan(null); setWidgets([]); setResult(null);
    // a failed first step unlocks the setup card again, so the user can change the choices or simply retry
    return run(`${BASE}/understand`, s, 'understanding', 'setup').then((failed) => { if (failed) setSetup(null); });
  }, [run]);

  const makePlan = useCallback((a: Record<string, string>, feedback = '', extraImages: string[] = []) => {
    if (!setup || !understanding) return;
    setAnswers(a);
    const q = Object.fromEntries(understanding.questions.map((x) => [x.id, x.question]));
    const named = Object.fromEntries(Object.entries(a).map(([id, v]) => [q[id] ?? id, v]));
    const images = [...(setup.images ?? []), ...extraImages].slice(-4);
    if (extraImages.length) setSetup({ ...setup, images });   // later plans / revisions keep seeing them
    return run(`${BASE}/plan`, { ...setup, images, understanding: understanding.understanding, answers: named, feedback, previous: plan?.widgets.map((w) => w.title) ?? [], name: plan?.name },
      'planning', feedback ? 'plan' : 'questions');
  }, [setup, understanding, plan, run]);

  const build = useCallback((keep: Set<number>) => {
    if (!setup || !plan) return;
    setWidgets([]);
    return run(`${BASE}/build`, { dataset_id: setup.dataset_id, name: plan.name, pages: plan.pages, widgets: plan.widgets.filter((w) => keep.has(w.idx)) }, 'building', 'plan');
  }, [setup, plan, run]);

  const stop = useCallback(() => abort.current?.abort(), []);
  const snapshot = (): SavedGen => ({ phase, setup, steps, evidence, understanding, answers, plan, widgets, result });
  const restore = useCallback((v: SavedGen) => {
    abort.current?.abort();
    const phaseNow = SETTLED[v.phase]?.(v) ?? v.phase;
    setPhase(phaseNow); setSetup(phaseNow === 'setup' ? null : v.setup); setSteps(stopSteps(v.steps ?? [], Date.now()).map((x) => (x.done ? x : { ...x, detail: x.detail })));
    setEvidence(v.evidence); setUnderstanding(v.understanding); setAnswers(v.answers ?? {}); setPlan(v.plan); setWidgets(v.widgets ?? []);
    setResult(v.result); setLive({}); setError(null);
  }, []);
  const restart = useCallback(() => { abort.current?.abort(); setPhase('setup'); setSetup(null); setSteps([]); setEvidence(null); setUnderstanding(null); setPlan(null); setWidgets([]); setResult(null); setError(null); }, []);

  return { snapshot, restore, phase, setup, steps, live, evidence, understanding, answers, plan, widgets, result, error, busy, start, makePlan, build, stop, restart };
}
