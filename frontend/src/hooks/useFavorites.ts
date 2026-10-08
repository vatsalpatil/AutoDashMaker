import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

/** A starred-ids set that survives reloads (per browser). `useFavorites('dashboards')` → { has, toggle, count }. */
export function useFavorites(scope: string) {
  const [ids, setIds] = useLocalStorage<string[]>(`favorites.${scope}`, []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])), [setIds]);
  return { has, toggle, count: ids.length };
}
