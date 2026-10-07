import { useCallback, useRef, useState } from 'react';

/**
 * Wrap a mutation (POST/PATCH/DELETE…) with {busy, error}. Replaces the repeated
 * `setBusy(true); setError(null); try {…} catch (e) { setError(e.message) } finally { setBusy(false) }`.
 *
 *   const [save, { busy, error }] = useAsyncAction(async (name: string) => { await api.post('/x', { name }); reload(); });
 *   <Button onClick={() => save('abc')} isDisabled={busy} />
 *
 * The returned function resolves to true on success and false on failure (the message is in `error`).
 */
export function useAsyncAction<A extends unknown[]>(action: (...args: A) => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(action);
  ref.current = action; // always call the latest closure without changing the returned function's identity

  const run = useCallback(async (...args: A): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await ref.current(...args);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return [run, { busy, error, setError }] as const;
}
