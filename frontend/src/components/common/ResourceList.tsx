import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/kit';
import type { ListViewMode } from '@/hooks/useListView';
import { cn } from '@/lib/utils';

export interface ListColumn<T> {
  header: string;
  cell: (item: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * One list renderer for datasets, sources, charts, dashboards… Describe the table columns once and give a
 * card renderer; the table/grid switch, empty state and styling come for free.
 *
 *   <ResourceList items={rows} view={view} columns={[{ header: 'Name', cell: (r) => r.name }]}
 *     renderCard={(r) => <Card>{r.name}</Card>} empty={{ title: 'Nothing yet' }} />
 */
export function ResourceList<T extends { id: string }>({ items, view, columns, renderCard, empty }: {
  items: T[];
  view: ListViewMode;
  columns: ListColumn<T>[];
  renderCard: (item: T) => ReactNode;
  empty: { title: string; description?: string };
}) {
  if (items.length === 0) return <EmptyState title={empty.title} description={empty.description} />;

  if (view === 'grid') {
    return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((it) => <div key={it.id}>{renderCard(it)}</div>)}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={cn('px-4 py-3 font-bold', c.align === 'right' ? 'text-right' : 'text-left')}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it) => (
            <tr key={it.id} className="transition-colors hover:bg-muted/50">
              {columns.map((c) => (
                <td key={c.header} className={cn('px-4 py-3', c.align === 'right' && 'text-right', c.className)}>{c.cell(it)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
