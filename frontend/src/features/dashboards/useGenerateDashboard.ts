import { useCallback, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth';

export interface GenStep { n: number; title: string; detail: string; items?: string[]; done: boolean }
export interface GenWidget { title: string; status: 'ok' | 'skipped'; detail?: string; page?: string; chart?: string; ms?: number | null; why?: string; formula?: string; sql?: string }
export interface GenResult { dashboard_id: string; name: string; pages: string[]; widgets: { title: string; type: string; page: string }[]; skipped: { title: string; reason: string }[] }
export interface GenInput { dataset_id: string; template: string; focus: string }

type GenEvent =
  | ({ type: 'step' } & Omit<GenStep, 'done'> & { done?: boolean })
  | ({ type: 'widget' } & GenWidget)
  | ({ type: 'done' } & GenResult)
  | { type: 'error'; kind?: string; message: string };

/** Starts /api/dashboards/generate/stream and keeps the visible process: steps (updated in place by number), widgets, result. */
export function useGenerateDashboard() {
  const [steps, setSteps] = useState<GenStep[]>([]);
  const [widgets, setWidgets] = useState<GenWidget[]>([]);
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<{ message: string; noProvider: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback(() => { setSteps([]); setWidgets([]); setResult(null); setError(null); }, []);

  const handle = (ev: GenEvent) => {
    if (ev.type === 'step') {
      const { type: _t, done, ...rest } = ev;
      setSteps((s) => (s.some((x) => x.n === ev.n) ? s.map((x) => (x.n === ev.n ? { ...x, ...rest, done: !!done } : x)) : [...s, { ...rest, done: !!done }]));
    } else if (ev.type === 'widget') {
      const { type: _t, ...w } = ev;
      setWidgets((ws) => [...ws, w]);
    } else if (ev.type === 'done') {
      const { type: _t, ...r } = ev;
      setResult(r);
    } else {
      setError({ message: ev.message, noProvider: ev.kind === 'no_provider' });
    }
  };

  const start = useCallback(async (input: GenInput) => {
    reset();
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await authFetch('/api/dashboards/generate/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: abort.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const p of parts) if (p.startsWith('data:')) handle(JSON.parse(p.slice(5)) as GenEvent);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError({ message: (e as Error).message, noProvider: false });
    } finally {
      setBusy(false);
    }
  }, [reset]);

  const stop = useCallback(() => abort.current?.abort(), []);
  return { steps, widgets, result, error, busy, start, stop, reset };
}
