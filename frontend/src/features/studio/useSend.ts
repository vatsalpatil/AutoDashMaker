import { useCallback, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import type { ProxyResponse, ServerRequest } from './studioModel';

export interface HistoryItem { id: string; at: number; kind: 'rest' | 'graphql'; method: string; url: string; status: number; ms: number; draft: unknown; saved?: boolean }

/** Send a request through the server and keep the last 40 in a local history (Hoppscotch's History tab); starred requests are kept as a saved collection. */
export function useSend() {
  const [response, setResponse] = useState<ProxyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('studio.history', []);

  const send = useCallback(async (req: ServerRequest, kind: HistoryItem['kind'], draft: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<ProxyResponse>('/studio/request', req);
      setResponse(res);
      const item: HistoryItem = { id: Math.random().toString(36).slice(2), at: Date.now(), kind, method: req.method, url: req.url, status: res.status, ms: res.elapsed_ms, draft };
      setHistory((h) => [item, ...h].filter((x, i) => i < 40 || x.saved));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setHistory]);

  return { response, error, loading, send, history, clearHistory: () => setHistory((h) => h.filter((x) => x.saved)),
    toggleSaved: (id: string) => setHistory((h) => h.map((x) => (x.id === id ? { ...x, saved: !x.saved } : x))), setResponse };
}
