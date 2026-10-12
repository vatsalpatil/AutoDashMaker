import type { GenStep, LiveLanes } from './useGenerateSession';

export type StepEvent = { type: 'step'; n: number; title: string; detail: string; items?: string[]; done?: boolean };
export type ThinkEvent = { type: 'think'; n: number; kind: 'reasoning' | 'answer' | 'reset'; text: string; lane: string; label: string };

/** Steps after a `step` event: a new step starts its timer, a finished one freezes it, a re-run step restarts it. */
export function applyStep(st: GenStep[], ev: StepEvent, now: number): GenStep[] {
  const { type: _t, done, ...rest } = ev;
  const cur = st.find((x) => x.n === ev.n);
  if (!cur) return [...st, { ...rest, done: !!done, spentMs: 0, startedAt: done ? undefined : now }];
  const running = cur.startedAt !== undefined;
  const next: GenStep = { ...cur, ...rest, done: !!done };
  if (done && running) { next.spentMs = cur.spentMs + (now - cur.startedAt!); next.startedAt = undefined; }
  else if (!done && !running) next.startedAt = now;
  return st.map((x) => (x.n === ev.n ? next : x));
}

/** Live lanes after a `think` event: the model's streaming reasoning / answer per step and lane (a reset starts a fresh box). */
export function applyThink(l: LiveLanes, ev: ThinkEvent): LiveLanes {
  const lanes = l[ev.n] ?? {};
  const cur = lanes[ev.lane] ?? { reasoning: '', answer: '', label: ev.label };
  const next = ev.kind === 'reset' ? { reasoning: '', answer: '', label: ev.label }
    : { ...cur, label: ev.label || cur.label, [ev.kind]: (cur[ev.kind] + ev.text).slice(-6000) };
  return { ...l, [ev.n]: { ...lanes, [ev.lane]: next } };
}

/** Freeze every running step's timer (the stream stopped or failed). */
export const stopSteps = (st: GenStep[], now: number): GenStep[] =>
  st.map((x) => (x.done ? x : { ...x, detail: 'Stopped before it finished.', spentMs: x.spentMs + (x.startedAt ? now - x.startedAt : 0), startedAt: undefined }));
