import { useCallback, useRef, useState } from 'react';
import { streamPost } from '@/lib/sse';
import type { GenStep, GenWidget, LiveLanes } from '../generate/useGenerateSession';
import { applyStep, applyThink, stopSteps, type StepEvent, type ThinkEvent } from '../generate/streamState';
import type { ReviewCheck } from './ReviewChecklist';

export interface OpLine { op: string; status: 'ok' | 'skipped'; text: string; detail?: string }
export interface RunPlan { name?: string; message?: string; widgets?: { title: string; type: string; why: string }[]; ops?: string[] }
export interface RunReview { score: number; checks: ReviewCheck[]; dropped: string[] }

type Ev<D> = StepEvent | ThinkEvent
  | ({ type: 'widget' } & GenWidget) | ({ type: 'op' } & OpLine) | ({ type: 'plan' } & RunPlan) | ({ type: 'review' } & RunReview)
  | ({ type: 'done' } & D) | { type: 'error'; kind?: string; message: string };

/** One streamed AI run (Create / Edit with AI): every phase, the plan, each widget or change, the self-review and the result. */
export function useAiRun<D>() {
  const [steps, setSteps] = useState<GenStep[]>([]);
  const [live, setLive] = useState<LiveLanes>({});
  const [plan, setPlan] = useState<RunPlan | null>(null);
  const [widgets, setWidgets] = useState<GenWidget[]>([]);
  const [ops, setOps] = useState<OpLine[]>([]);
  const [review, setReview] = useState<RunReview | null>(null);
  const [done, setDone] = useState<D | null>(null);
  const [error, setError] = useState<{ message: string; noProvider: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const handle = useCallback((ev: Ev<D>) => {
    if (ev.type === 'step') {
      if (ev.done) setLive((l) => { const { [ev.n]: _gone, ...rest } = l; return rest; });
      setSteps((st) => applyStep(st, ev, Date.now()));
    } else if (ev.type === 'think') setLive((l) => applyThink(l, ev));
    else if (ev.type === 'plan') { const { type: _t, ...p } = ev; setPlan(p); }
    else if (ev.type === 'widget') { const { type: _t, ...w } = ev; setWidgets((ws) => [...ws, w]); }
    else if (ev.type === 'op') { const { type: _t, ...o } = ev; setOps((os) => [...os, o]); }
    else if (ev.type === 'review') { const { type: _t, ...r } = ev; setReview(r); }
    else if (ev.type === 'done') { const { type: _t, ...d } = ev; setDone(d as unknown as D); }
    else setError({ message: ev.message, noProvider: ev.kind === 'no_provider' });
  }, []);

  const reset = useCallback(() => {
    setSteps([]); setLive({}); setPlan(null); setWidgets([]); setOps([]); setReview(null); setDone(null); setError(null);
  }, []);

  /** Stream `path`; resolves with the `done` payload (null when it failed or was stopped), the changes it reported and any error. */
  const run = useCallback(async (path: string, body: unknown): Promise<{ done: D | null; ops: OpLine[]; error: { message: string; noProvider: boolean } | null }> => {
    reset();
    setBusy(true);
    abort.current = new AbortController();
    let result: D | null = null;
    let err: { message: string; noProvider: boolean } | null = null;
    const seen: OpLine[] = [];
    try {
      await streamPost<Ev<D>>(path, body, (ev) => {
        if (ev.type === 'done') { const { type: _t, ...d } = ev; result = d as unknown as D; }
        if (ev.type === 'op') { const { type: _t, ...o } = ev; seen.push(o); }
        if (ev.type === 'error') err = { message: ev.message, noProvider: ev.kind === 'no_provider' };
        handle(ev);
      }, abort.current.signal);
    } catch (e) {
      err = { message: (e as Error).name === 'AbortError' ? 'Stopped.' : (e as Error).message, noProvider: false };
      setError(err);
    }
    if (!result) { setSteps((st) => stopSteps(st, Date.now())); setLive({}); }
    setBusy(false);
    return { done: result, ops: seen, error: err ?? (result ? null : { message: 'Stopped before it finished.', noProvider: false }) };
  }, [handle, reset]);

  const stop = useCallback(() => abort.current?.abort(), []);
  return { steps, live, plan, widgets, ops, review, done, error, busy, run, stop, reset };
}

export type AiRun = ReturnType<typeof useAiRun<unknown>>;
