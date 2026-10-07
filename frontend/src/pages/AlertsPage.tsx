import { useMemo } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { useFieldFilters, type FieldDef } from '@/components/common/useFieldFilters';
import { EmptyState } from '@/components/ui/kit';
import { AlertCard } from '@/features/alerts/AlertCard';
import { AlertForm } from '@/features/alerts/AlertForm';
import { useApi } from '@/hooks/useApi';
import type { Alert, Dataset } from '@/lib/types';

const status = (a: Alert) => a.last_status ?? 'never run';

/** Metric alerts: create, run, pause, inspect history; ReUI filters narrow the list. */
export default function AlertsPage() {
  const alerts = useApi<Alert[]>('/alerts');
  const datasets = useApi<Dataset[]>('/datasets').data ?? [];
  const names = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);

  const fields = useMemo<FieldDef<Alert>[]>(() => [
    { id: 'name', label: 'Name', type: 'text', get: (a) => a.name },
    { id: 'status', label: 'Status', type: 'select', get: status, options: ['ok', 'triggered', 'error', 'never run'].map((v) => ({ value: v, label: v })) },
    { id: 'dataset', label: 'Dataset', type: 'select', get: (a) => a.dataset_id, options: datasets.map((d) => ({ value: d.id, label: d.name })) },
    { id: 'state', label: 'State', type: 'select', get: (a) => (a.active ? 'active' : 'paused'), options: [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }] },
  ], [datasets]);
  const filters = useFieldFilters(fields);

  if (!alerts.data) return alerts.error ? <ErrorBanner message={alerts.error} /> : <Loading />;
  const shown = filters.apply(alerts.data);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Alerts" description="Get notified when a metric crosses a line you care about." />
      <AlertForm datasets={datasets} onCreated={alerts.reload} />
      <div className="flex flex-wrap items-center gap-2">{filters.bar}</div>
      {shown.length === 0
        ? <EmptyState title={alerts.data.length ? 'No alerts match the filters' : 'No alerts yet'} description={alerts.data.length ? undefined : 'Create one above.'} />
        : shown.map((a) => <AlertCard key={a.id} alert={a} datasetName={names.get(a.dataset_id)} onChanged={alerts.reload} />)}
    </div>
  );
}
