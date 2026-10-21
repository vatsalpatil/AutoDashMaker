import { useMemo } from 'react';
import { api } from '@/lib/api';
import { useAsyncAction } from '@/hooks/useAsyncAction';

type Method = 'post' | 'put' | 'del';

/**
 * One backoffice mutation: optional confirm prompt, call, then reload the page's data.
 *   const act = useAdminAction(reload);
 *   act.run('del', `/admin/data/datasets/${id}`, undefined, 'Delete this dataset?')
 */
export function useAdminAction(after?: () => void) {
  const [run, state] = useAsyncAction(async (method: Method, path: string, body?: unknown, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (method === 'del') await api.del(path);
    else await api[method](path, body);
    after?.();
  });
  return { run, ...state };
}

/** Case-insensitive search over the given fields of each row. */
export function useSearch<T>(rows: T[] | null, q: string, fields: (keyof T)[]) {
  return useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows || !needle) return rows ?? [];
    return rows.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q]);
}

/** Download rows as a CSV file (backoffice exports). */
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
