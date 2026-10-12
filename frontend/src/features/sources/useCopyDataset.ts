import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type CopyState = 'idle' | 'running' | 'done' | 'error';
interface Status { state: CopyState; error?: string }

/** Copy a live-linked table into the app (a background job on the server, polled here). Resumes if the page was reloaded mid-copy. */
export function useCopyDataset(datasetId: string | undefined, onDone: () => void) {
  const [state, setState] = useState<CopyState>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const stopPolling = useCallback(() => { if (timer.current) { clearInterval(timer.current); timer.current = null; } }, []);
  const apply = useCallback((s: Status) => {
    setState(s.state);
    setError(s.error ?? null);
    if (s.state !== 'running') { stopPolling(); if (s.state === 'done') done.current(); }
  }, [stopPolling]);
  const poll = useCallback(() => {
    if (!datasetId || timer.current) return;
    timer.current = setInterval(() => { api.get<Status>(`/datasets/${datasetId}/copy-status`).then(apply).catch((e: Error) => { setError(e.message); setState('error'); stopPolling(); }); }, 3000);
  }, [datasetId, apply, stopPolling]);

  useEffect(() => {
    setState('idle'); setError(null); stopPolling();
    if (datasetId) api.get<Status>(`/datasets/${datasetId}/copy-status`).then((s) => { if (s.state === 'running') { setState('running'); poll(); } }).catch(() => {});
    return stopPolling;
  }, [datasetId, poll, stopPolling]);

  const start = useCallback(async () => {
    if (!datasetId) return;
    setError(null);
    try {
      const s = await api.post<Status>(`/datasets/${datasetId}/to-copy`);
      apply(s);
      if (s.state === 'running') poll();
    } catch (e) { setError((e as Error).message); setState('error'); }
  }, [datasetId, apply, poll]);

  return { state, error, start, busy: state === 'running' };
}
