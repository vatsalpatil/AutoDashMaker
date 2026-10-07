import { useCallback, useState } from 'react';

/** Read a JSON value from localStorage, falling back to `initial` (storage can be missing, blocked or corrupt). */
export function readStorage<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return initial;
    const parsed = JSON.parse(raw);
    // objects are merged over the defaults so newly added fields never come back undefined
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && initial && typeof initial === 'object'
      ? ({ ...initial, ...parsed } as T)
      : (parsed as T);
  } catch {
    return initial;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota): the app keeps working without persistence */
  }
}

/**
 * useState that survives reloads. One implementation of the "try/catch around localStorage" pattern, so
 * panels, grids, notebooks and preferences all persist the same way.
 *
 *   const [prefs, setPrefs] = useLocalStorage('workbench.ai', { autoApply: true });
 *   setPrefs({ autoApply: false });            // or setPrefs((p) => ({ ...p, autoApply: false }))
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writeStorage(key, resolved);
      return resolved;
    });
  }, [key]);

  return [value, set] as const;
}
