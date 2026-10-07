import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import type { SavedQuery } from '@/lib/types';
import type { Notebook } from './useNotebook';

/**
 * Saved queries and the notebook actions tied to them: save a cell as a standalone query, update the saved
 * query a cell was loaded from, delete one. A cell is saved as its COMBINED sql (earlier cells chained in),
 * so the stored query runs on its own.
 */
export function useSavedQueries(nb: Notebook, onError: (message: string) => void) {
  const list = useApi<SavedQuery[]>('/queries');
  const queries = list.data ?? [];
  const fail = (e: unknown) => onError((e as Error).message);

  async function saveCell(id: string) {
    if (!(await nb.runCell(id))) return;
    const cell = nb.getCell(id);
    if (!cell?.result) return;
    try {
      await api.post('/queries/run', { sql: cell.result.sql, save: true, name: cell.name });
      list.reload();
    } catch (e) {
      fail(e);
    }
  }

  async function updateCell(id: string) {
    if (!nb.getCell(id)?.saved || !(await nb.runCell(id))) return;
    const cell = nb.getCell(id);
    if (!cell?.result || !cell.saved) return;
    try {
      const saved = await api.patch<SavedQuery>(`/queries/${cell.saved.id}`, { sql: cell.result.sql });
      nb.update(id, { saved: { ...saved, sql: cell.sql } }); // baseline = what the cell shows, so "unsaved" clears
      list.setData((qs) => (qs ?? []).map((q) => (q.id === saved.id ? { ...q, ...saved } : q)));
    } catch (e) {
      fail(e);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/queries/${id}`);
      list.setData((qs) => (qs ?? []).filter((q) => q.id !== id));
      nb.commit((cs) => cs.map((c) => (c.saved?.id === id ? { ...c, saved: null } : c)));
    } catch (e) {
      fail(e);
    }
  }

  return { queries, saveCell, updateCell, remove, reload: list.reload };
}
