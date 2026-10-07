import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { IconButton } from '@/components/common/IconButton';
import { SearchBox, ViewToggle } from '@/components/common/ListControls';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { ResourceList, type ListColumn } from '@/components/common/ResourceList';
import { Badge, Button, Card } from '@/components/ui/kit';
import { ChartThumb } from '@/features/charts/ChartThumb';
import { useFieldFilters, type FieldDef } from '@/components/common/useFieldFilters';
import { KINDS, kindOf } from '@/features/charts/chartKinds';
import { useApi } from '@/hooks/useApi';
import { useListView } from '@/hooks/useListView';
import { api } from '@/lib/api';
import type { Chart } from '@/lib/types';

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');
const mapping = (c: Chart) => [c.spec.encoding.x, ...(c.spec.encoding.ys?.length ? c.spec.encoding.ys : [c.spec.encoding.y])].filter(Boolean).join(' → ');

const FIELDS: FieldDef<Chart>[] = [
  { id: 'type', label: 'Type', type: 'select', get: (c) => c.spec.type, options: KINDS.map((k) => ({ value: k.id, label: k.label })) },
  { id: 'name', label: 'Name', type: 'text', get: (c) => c.name },
  { id: 'mapping', label: 'Column', type: 'text', get: mapping },
];

/** Saved charts as a table or a grid of live thumbnails; creating and editing happen in the chart studio. */
export default function ChartsPage() {
  const nav = useNavigate();
  const { data: charts, error, reload } = useApi<Chart[]>('/charts');
  const { view, setView, query, setQuery, filter } = useListView();
  const filters = useFieldFilters(FIELDS);

  async function remove(c: Chart) {
    if (!confirm(`Delete chart “${c.name}”?`)) return;
    await api.del(`/charts/${c.id}`);
    reload();
  }
  if (!charts) return error ? <ErrorBanner message={error} /> : <Loading />;

  const shown = filters.apply(filter(charts, (c) => [c.name, c.spec.type, c.spec.encoding.x, c.spec.encoding.y]));
  const columns: ListColumn<Chart>[] = [
    { header: 'Chart', cell: (c) => <Link to={`/charts/${c.id}`} className="font-semibold text-primary hover:underline">{c.name}</Link> },
    { header: 'Type', cell: (c) => <Badge variant="purple" label={kindOf(c.spec.type).label} /> },
    { header: 'Mapping', className: 'mono text-xs', cell: mapping },
    { header: 'Created', className: 'text-xs text-muted-foreground', cell: (c) => date(c.created_at) },
    {
      header: 'Actions', align: 'right',
      cell: (c) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={`/charts/${c.id}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted"><Pencil className="size-3.5" /> Edit</Link>
          <IconButton title="Delete chart" danger onClick={() => remove(c)}><Trash2 className="size-4" /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Charts" description="Build, style and reuse visualizations backed by live queries."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} label="New chart" onClick={() => nav('/charts/new')} />} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved charts <Badge label={String(charts.length)} /></span>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Search by name, type or column…" />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{filters.bar}</div>
      <ResourceList items={shown} view={view} columns={columns}
        empty={{ title: 'No charts yet', description: 'Create one from a saved query — pick a template and tweak every option.' }}
        renderCard={(c) => (
          <Link to={`/charts/${c.id}`} className="block">
            <Card padding={0} className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="border-b bg-muted/30 p-3"><ChartThumb chart={c} /></div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0"><div className="truncate font-semibold">{c.name}</div><div className="mono truncate text-xs text-muted-foreground">{mapping(c)}</div></div>
                <Badge variant="purple" label={kindOf(c.spec.type).label} />
              </div>
            </Card>
          </Link>
        )} />
    </div>
  );
}
