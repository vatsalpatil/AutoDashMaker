import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './useLocalStorage';

const KEY = 'datagrid.toolbar';
let open = readStorage(KEY, true);
const listeners = new Set<() => void>();

/** Whether data grids show their search / columns / export row. One shared, remembered setting, so a button elsewhere
 *  (e.g. a notebook cell's output header) can drive every grid on the page. */
export function useGridToolbar(): [boolean, (v?: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => open,
  );
  const set = (v?: boolean) => {
    open = v ?? !open;
    writeStorage(KEY, open);
    listeners.forEach((l) => l());
  };
  return [value, set];
}
