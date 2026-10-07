import { RefreshCw } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { useFieldFilters, type FieldDef } from '@/components/common/useFieldFilters';
import { Button, EmptyState } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { QualityRun } from '@/lib/types';
import { QualityBadge } from '@/pages/QualityBadge';

const FIELDS: FieldDef<QualityRun>[] = [
  { id: 'dataset', label: 'Dataset', type: 'text', get: (r) => r.dataset_name ?? r.dataset_id },
  { id: 'completeness', label: 'Completeness', type: 'number', get: (r) => r.completeness },
  { id: 'uniqueness', label: 'Uniqueness', type: 'number', get: (r) => r.uniqueness },
  { id: 'validity', label: 'Validity', type: 'number', get: (r) => r.validity },
  { id: 'rows', label: 'Rows', type: 'number', get: (r) => r.row_count },
];
const HEADERS = ['Dataset', 'Completeness', 'Uniqueness', 'Validity', 'Duplicate %', 'Freshness', 'Rows', ''];

/** Latest quality scores per dataset; filter by score or size, re-run a check in place. */
export default function QualityPage() {
  const { data: rows, error: loadError, reload } = useApi<QualityRun[]>('/quality/overview');
  const filters = useFieldFilters(FIELDS);
  const [check, { busy, error }] = useAsyncAction(async (datasetId: string) => {
    await api.post(`/quality/run/${datasetId}`);
    reload();
  });

  if (!rows) return loadError ? <ErrorBanner message={loadError} /> : <Loading />;
  const shown = filters.apply(rows);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Data Quality" description="Completeness, uniqueness and validity of every dataset, from its latest check." />
      <ErrorBanner message={error} />
      <div className="flex flex-wrap items-center gap-2">{filters.bar}</div>
      {shown.length === 0
        ? <EmptyState title={rows.length ? 'No datasets match the filters' : 'No quality runs yet'} description={rows.length ? undefined : "Run a check from a dataset's Quality tab."} />
        : (
          <div className="overflow-auto rounded-xl border bg-card shadow-xs">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/50"><tr>{HEADERS.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {shown.map((r) => (
                  <tr key={r.dataset_id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{r.dataset_name ?? `#${r.dataset_id}`}</td>
                    <td className="px-3 py-2"><QualityBadge value={r.completeness} /></td>
                    <td className="px-3 py-2"><QualityBadge value={r.uniqueness} /></td>
                    <td className="px-3 py-2"><QualityBadge value={r.validity} /></td>
                    <td className="px-3 py-2">{r.duplicate_pct ?? '—'}%</td>
                    <td className="px-3 py-2">{String(r.freshness ?? '—')}</td>
                    <td className="px-3 py-2 tabular-nums">{r.row_count?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" label="Run check" icon={<RefreshCw className="size-3.5" />}
                        onClick={() => check(r.dataset_id)} isDisabled={busy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
