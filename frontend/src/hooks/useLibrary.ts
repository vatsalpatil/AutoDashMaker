import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from './useLocalStorage';

export interface LibItem { id: string; name: string; createdAt: number; updatedAt: number }
interface Stored<T> { activeId: string; items: T[] }

const uid = () => Math.random().toString(36).slice(2, 10);

/** Read a saved library from localStorage (non-React callers use this too). */
export function readLibrary<T extends LibItem>(key: string): Stored<T> | null {
  const s = readStorage<Stored<T> | null>(key, null);
  return s && Array.isArray(s.items) && s.items.length > 0 ? s : null;
}
export const writeLibrary = <T extends LibItem>(key: string, lib: Stored<T>) => writeStorage(key, lib);

/**
 * A remembered list of named things with one active item (notebooks, AI chats): create, open, rename, duplicate, delete.
 * `seed()` makes the first item (and the replacement when the last one is deleted); `migrate` may produce the initial library
 * from older storage.
 */
export function useLibrary<T extends LibItem>(key: string, seed: () => Omit<T, keyof LibItem>, migrate?: () => Stored<T> | null) {
  const make = useCallback((name: string, rest: Omit<T, keyof LibItem>): T => ({ ...rest, id: uid(), name, createdAt: Date.now(), updatedAt: Date.now() } as T), []);
  const [lib, setLib] = useState<Stored<T>>(() => {
    const stored = readLibrary<T>(key) ?? migrate?.();
    if (stored) return { ...stored, activeId: stored.items.some((i) => i.id === stored.activeId) ? stored.activeId : stored.items[0].id };
    const first = make('Untitled', seed());
    return { activeId: first.id, items: [first] };
  });
  useEffect(() => writeLibrary(key, lib), [key, lib]);

  const active = lib.items.find((i) => i.id === lib.activeId) ?? lib.items[0];
  const set = (fn: (l: Stored<T>) => Stored<T>) => setLib(fn);

  return {
    items: lib.items, active,
    select: (id: string) => set((l) => (l.items.some((i) => i.id === id) ? { ...l, activeId: id } : l)),
    /** Add an item (and open it unless `open` is false). Returns it. */
    create: (name: string, rest: Omit<T, keyof LibItem> = seed(), open = true): T => {
      const item = make(name, rest);
      set((l) => ({ activeId: open ? item.id : l.activeId, items: [item, ...l.items] }));
      return item;
    },
    /** Change an item; `patch` may be a function of the item's CURRENT state (safe inside async callbacks). */
    update: (id: string, patch: Partial<Omit<T, 'id'>> | ((item: T) => Partial<Omit<T, 'id'>>)) =>
      set((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch), updatedAt: Date.now() } : i)) })),
    rename: (id: string, name: string) => set((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, name: name.trim() || i.name, updatedAt: Date.now() } : i)) })),
    duplicate: (id: string) => {
      const src = lib.items.find((i) => i.id === id);
      if (!src) return null;
      const { id: _i, name: _n, createdAt: _c, updatedAt: _u, ...rest } = JSON.parse(JSON.stringify(src)) as T;   // deep copy
      const item = make(`${src.name} (copy)`, rest as unknown as Omit<T, keyof LibItem>);
      set((l) => ({ activeId: item.id, items: [item, ...l.items] }));
      return item;
    },
    remove: (id: string) => set((l) => {
      const items = l.items.filter((i) => i.id !== id);
      if (items.length === 0) { const first = make('Untitled', seed()); return { activeId: first.id, items: [first] }; }
      return { activeId: l.activeId === id ? items[0].id : l.activeId, items };
    }),
  };
}
