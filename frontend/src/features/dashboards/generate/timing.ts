import { useEffect, useState } from 'react';
import type { GenStep } from './useGenerateSession';

/** Time a step has taken: finished segments plus the one still running (a revised plan re-runs its step, so segments add up). */
export const stepMs = (s: GenStep, now: number): number => s.spentMs + (s.startedAt ? Math.max(0, now - s.startedAt) : 0);

/** All AI working time of the session: the sum of its steps (time spent waiting for your answers is not counted). */
export const totalMs = (steps: GenStep[], now: number): number => steps.reduce((sum, s) => sum + stepMs(s, now), 0);

/** Whole seconds and minutes: 800 -> '0s', 12340 -> '12s', 75000 -> '1m 15s', 3605000 -> '60m 05s' */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

/** `Date.now()` that updates four times a second while `active` (so running timers tick), and holds still otherwise. */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) { setNow(Date.now()); return; }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
