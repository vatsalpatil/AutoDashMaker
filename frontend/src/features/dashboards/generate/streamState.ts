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

/** One model call's full thinking, kept after its step finishes (the "Full thinking" panel and saved sessions). */
export interface ThinkEntry { id: string; n: number; lane: string; label: string; reasoning: string; answer: string }
const LOG_CAP = 40000;

/** Log after a `think` event: text joins the lane's latest entry; a reset (a retry or a new run) opens a new entry. */
export function appendLog(log: ThinkEntry[], ev: ThinkEvent, run: number): ThinkEntry[] {
  const id = `${run}:${ev.n}:${ev.lane}`;
  let i = log.length - 1;
  while (i >= 0 && !log[i].id.startsWith(id)) i--;
  if (i < 0 || ev.kind === 'reset') {
    const entry = { id: `${id}:${log.length}`, n: ev.n, lane: ev.lane, label: ev.label, reasoning: '', answer: '' };
    return ev.kind === 'reset' && i >= 0 && !log[i].reasoning && !log[i].answer ? log : [...log, entry];
  }
  const cur = log[i];
  const next = { ...cur, label: ev.label || cur.label, [ev.kind]: (cur[ev.kind] + ev.text).slice(-LOG_CAP) };
  return log.map((e, j) => (j === i ? next : e));
}
