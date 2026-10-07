import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { ResourceList, type ListColumn } from '@/components/common/ResourceList';
import { Badge, Card } from '@/components/ui/kit';
import type { ListViewMode } from '@/hooks/useListView';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { typeBadge } from './sourceSchemas';

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');

export function DatasetsTab({ datasets, view, refreshing, onRefresh, onRemove }: {
  datasets: Dataset[];
  view: ListViewMode;
  refreshing: Record<string, boolean>;
  onRefresh: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const columns: ListColumn<Dataset>[] = [
    { header: 'Dataset Name', cell: (d) => <Link to={`/datasets/${d.id}`} className="font-semibold text-primary hover:underline">{d.name}</Link> },
    { header: 'Kind / Source', cell: (d) => d.kind && <span className="flex items-center gap-1.5"><Badge variant={typeBadge(d.kind)} label={d.kind} />{d.remote_table && <Badge variant="purple" label="live" />}</span> },
    { header: 'Row Count', className: 'mono', cell: (d) => (d.row_count !== undefined ? d.row_count.toLocaleString() : '—') },
    { header: 'Columns', className: 'mono', cell: (d) => { const n = d.column_count ?? d.columns?.length; return n ? `${n} cols` : '—'; } },
    { header: 'Created At', className: 'text-xs text-muted-foreground', cell: (d) => date(d.created_at) },
    {
      header: 'Actions', align: 'right',
      cell: (d) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={`/datasets/${d.id}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" /> Explore
          </Link>
          <IconButton title="Re-ingest dataset" disabled={refreshing[d.id]} onClick={() => onRefresh(d.id)}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing[d.id] && 'animate-spin')} />
          </IconButton>
          <IconButton title="Delete dataset" danger onClick={() => onRemove(d.id)}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <ResourceList
      items={datasets}
      view={view}
      columns={columns}
      empty={{ title: 'No datasets found', description: 'Upload a file using the box above or connect a database source.' }}
      renderCard={(d) => (
        <Link to={`/datasets/${d.id}`}>
          <Card padding={3}>
            <div className="font-semibold text-primary hover:underline">{d.name}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.kind && <Badge label={d.kind} />}
              {d.remote_table && <Badge variant="purple" label="live" />}
              {d.row_count !== undefined && <Badge variant="blue" label={`${d.row_count.toLocaleString()} rows`} />}
              {(d.column_count ?? d.columns?.length) ? <Badge label={`${d.column_count ?? d.columns?.length} columns`} /> : null}
              {d.created_at && <Badge label={date(d.created_at)} />}
            </div>
          </Card>
        </Link>
      )}
    />
  );
}
