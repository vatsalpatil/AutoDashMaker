import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { AuditItem } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

/** Recently run queries (from the audit log): click to load into the active cell, + to add as a new step. */
export function HistoryTab({ filter, onLoadSql, onAddStep }: { filter: string; onLoadSql: (sql: string) => void; onAddStep: (sql: string) => void }) {
  const { data, error } = useApi<{ items: AuditItem[] }>('/audit?limit=200&action=query.run');
  const items = useMemo(() => {
    const seen = new Set<string>();
    const q = filter.trim().toLowerCase();
    return (data?.items ?? []).filter((a) => {
      const sql = (a.detail ?? '').split(' -- ')[0].trim();
      if (!sql || seen.has(sql) || (q && !sql.toLowerCase().includes(q))) return false;
      seen.add(sql);
      return true;
    }).slice(0, 60);
  }, [data, filter]);

  if (error) return <p className="p-2 text-xs text-destructive">{error}</p>;
  if (!data) return <p className="p-2 text-xs text-muted-foreground">Loading…</p>;
  if (items.length === 0) return <p className="p-2 text-xs text-muted-foreground">No history yet.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((a) => {
        const sql = (a.detail ?? '').split(' -- ')[0].trim();
        return (
          <li key={a.id} className="group rounded-md border">
            <button type="button" onClick={() => onLoadSql(sql)} title={sql} className="block w-full px-2 pt-1 text-left">
              <span className="mono line-clamp-2 break-all text-[11px]">{sql}</span>
            </button>
            <div className="flex items-center gap-2 px-2 pb-1 text-[10px] text-muted-foreground">
              <span className={cn(a.status !== 'ok' && 'text-destructive')}>{a.status}</span>
              {a.duration_ms != null && <span>{Math.round(a.duration_ms)} ms</span>}
              <span>{timeAgo(a.created_at)}</span>
              <button type="button" onClick={() => onAddStep(sql)} aria-label="Add as new step" title="Add as new step" className="ml-auto rounded p-0.5 hover:bg-accent hover:text-foreground"><Plus className="size-3" /></button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
