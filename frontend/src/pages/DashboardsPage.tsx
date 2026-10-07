import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { IconButton } from '@/components/common/IconButton';
import { SearchBox, ViewToggle } from '@/components/common/ListControls';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { ResourceList, type ListColumn } from '@/components/common/ResourceList';
import { useFieldFilters, type FieldDef } from '@/components/common/useFieldFilters';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { AiDashboardDialog } from '@/features/dashboards/AiDashboardDialog';
import { GenerateDashboardDialog } from '@/features/dashboards/GenerateDashboardDialog';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useListView } from '@/hooks/useListView';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/types';

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');
const FIELDS: FieldDef<Dashboard>[] = [
  { id: 'name', label: 'Name', type: 'text', get: (d) => d.name },
  { id: 'description', label: 'Description', type: 'text', get: (d) => d.description },
];

/** Saved dashboards (table or cards) with create, generate-from-dataset and ReUI filters. */
export default function DashboardsPage() {
  const { data: dashboards, error: loadError, reload } = useApi<Dashboard[]>('/dashboards');
  const { view, setView, query, setQuery, filter } = useListView();
  const filters = useFieldFilters(FIELDS);
  const [name, setName] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);

  const [create, { busy, error: createError }] = useAsyncAction(async () => {
    await api.post('/dashboards', { name });
    setName('');
    reload();
  });
  const [remove] = useAsyncAction(async (d: Dashboard) => {
    if (!confirm(`Delete dashboard “${d.name}”?`)) return;
    await api.del(`/dashboards/${d.id}`);
    reload();
  });

  if (!dashboards) return loadError ? <ErrorBanner message={loadError} /> : <Loading />;
  const shown = filters.apply(filter(dashboards, (d) => [d.name, d.description]));

  const columns: ListColumn<Dashboard>[] = [
    { header: 'Dashboard', cell: (d) => <Link to={`/dashboards/${d.id}`} className="font-semibold text-primary hover:underline">{d.name}</Link> },
    { header: 'Description', className: 'text-muted-foreground', cell: (d) => d.description || '—' },
    { header: 'Created', className: 'text-xs text-muted-foreground', cell: (d) => date(d.created_at) },
    {
      header: 'Actions', align: 'right',
      cell: (d) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={`/dashboards/${d.id}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted"><ExternalLink className="size-3.5" /> Open</Link>
          <IconButton title="Delete dashboard" danger onClick={() => remove(d)}><Trash2 className="size-4" /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboards" description="Interactive multi-widget analytics dashboards with layout persistence."
        actions={<>
          <Button variant="secondary" label="Generate from dataset" icon={<Wand2 className="size-4" />} onClick={() => setGenOpen(true)} />
          <Button variant="primary" label="Create with AI" icon={<Sparkles className="size-4" />} onClick={() => setAiOpen(true)} />
        </>} />
      <ErrorBanner message={createError ?? extraError} onDismiss={() => setExtraError(null)} />

      <Card padding={3}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1"><TextInput label="New dashboard name" value={name} onChange={setName} placeholder="e.g. Weekly sales overview" /></div>
          <Button variant="primary" label={busy ? 'Creating…' : 'Create dashboard'} icon={<Plus className="size-4" />} onClick={() => create()} isDisabled={busy || !name.trim()} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved dashboards <Badge label={String(dashboards.length)} /></span>
        <div className="ml-auto flex items-center gap-2"><SearchBox value={query} onChange={setQuery} placeholder="Search dashboards…" /><ViewToggle value={view} onChange={setView} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{filters.bar}</div>

      <ResourceList items={shown} view={view} columns={columns}
        empty={{ title: 'No dashboards found', description: 'Create one above, then add widgets from your charts.' }}
        renderCard={(d) => (
          <Link to={`/dashboards/${d.id}`} className="block">
            <Card padding={3} className="transition-shadow hover:shadow-md">
              <div className="font-semibold text-primary">{d.name}</div>
              {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{date(d.created_at)}</p>
            </Card>
          </Link>
        )} />

      <AiDashboardDialog open={aiOpen} onClose={() => setAiOpen(false)} />
      <GenerateDashboardDialog open={genOpen} onClose={() => setGenOpen(false)} onError={setExtraError} />
    </div>
  );
}
