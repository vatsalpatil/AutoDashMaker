import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface RefreshState { running: boolean; elapsed: number; error?: string }
interface JobStatus { status: 'idle' | 'running' | 'done' | 'error'; elapsed_s?: number; error?: string | null }

const POLL_MS = 1500;

/**
 * Dataset refreshes run as server-side jobs (a big table takes a minute). `start(id)` kicks one off and this hook
 * polls it, exposing `{running, elapsed, error}` per dataset. `resume(id)` re-attaches to a job that is already
 * running (e.g. after navigating away and back). `onDone(id)` fires when a refresh finishes successfully.
 */
export function useDatasetRefresh(onDone?: (id: string) => void) {
  const [state, setState] = useState<Record<string, RefreshState>>({});
  const timers = useRef<Record<string, number>>({});
  const done = useRef(onDone);
  done.current = onDone;

  const set = (id: string, s: RefreshState) => setState((m) => ({ ...m, [id]: s }));
  const stop = (id: string) => { window.clearInterval(timers.current[id]); delete timers.current[id]; };

  const poll = useCallback((id: string) => {
    stop(id);
    timers.current[id] = window.setInterval(async () => {
      try {
        const s = await api.get<JobStatus>(`/datasets/${id}/refresh-status`);
        if (s.status === 'running') { set(id, { running: true, elapsed: s.elapsed_s ?? 0 }); return; }
        stop(id);
        set(id, { running: false, elapsed: s.elapsed_s ?? 0, error: s.status === 'error' ? s.error ?? 'Refresh failed' : undefined });
        if (s.status === 'done') done.current?.(id);
      } catch (e) {
        stop(id);
        set(id, { running: false, elapsed: 0, error: (e as Error).message });
      }
    }, POLL_MS);
  }, []);

  const start = useCallback(async (id: string) => {
    set(id, { running: true, elapsed: 0 });
    try {
      await api.post(`/datasets/${id}/refresh?background=true`);
      poll(id);
    } catch (e) {
      set(id, { running: false, elapsed: 0, error: (e as Error).message });
    }
  }, [poll]);

  const resume = useCallback(async (id: string) => {
    try {
      const s = await api.get<JobStatus>(`/datasets/${id}/refresh-status`);
      if (s.status === 'running') { set(id, { running: true, elapsed: s.elapsed_s ?? 0 }); poll(id); }
    } catch { /* no job to resume */ }
  }, [poll]);

  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearInterval(t)), []);
  return { state, start, resume };
}
