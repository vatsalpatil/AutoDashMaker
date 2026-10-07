import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  /** true until the first response (or failure) arrives, and again on `reload()` */
  loading: boolean;
  reload: () => void;
  /** replace the cached data locally (optimistic updates after a save/delete) */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * GET a path and keep {data, error, loading}. Replaces the per-page
 * `useEffect(() => api.get(...).then(setX).catch(setError))` boilerplate.
 *
 *   const { data: sources, loading, error, reload } = useApi<Source[]>('/sources');
 *
 * Pass `null` as the path to skip fetching (e.g. until an id is known). Stale responses are ignored
 * when the path changes or the component unmounts.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const id = ++latest.current;
    setLoading(true);
    api.get<T>(path)
      .then((d) => { if (id === latest.current) { setData(d); setError(null); } })
      .catch((e: Error) => { if (id === latest.current) setError(e.message); })
      .finally(() => { if (id === latest.current) setLoading(false); });
    return () => { latest.current++; };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
