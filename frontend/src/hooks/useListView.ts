import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ListViewMode = 'table' | 'grid';

/**
 * Search text + table/grid mode for a list page (the mode is remembered across pages and visits).
 *
 *   const { view, setView, query, setQuery, filter } = useListView();
 *   const shown = filter(items, (c) => [c.name, c.type]);
 */
export function useListView() {
  const [view, setView] = useLocalStorage<ListViewMode>('list.view', 'table');
  const [query, setQuery] = useState('');

  /** Items where any of the given text fields contains the query (case-insensitive). */
  const filter = useCallback(<T,>(items: T[], fields: (item: T) => (string | null | undefined)[]): T[] => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => fields(it).some((f) => f?.toLowerCase().includes(q)));
  }, [query]);

  return { view, setView, query, setQuery, filter };
}
