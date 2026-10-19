import { Play, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { Badge, Button } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { AddTestForm, type NewTest } from './AddTestForm';

interface DataTest { id: string; label: string; severity: 'error' | 'warn'; last_status?: 'pass' | 'fail'; last_detail?: string; last_run_at?: string }

/** dbt-style data tests: checked after every refresh; a failing "roll back" test restores the previous version. */
export function TestsPanel({ datasetId, columns }: { datasetId: string; columns: string[] }) {
  const base = `/datasets/${datasetId}/tests`;
  const tests = useApi<DataTest[]>(base);
  const [add, addState] = useAsyncAction(async (t: NewTest) => { await api.post(base, t); tests.reload(); });
  const [runAll, runState] = useAsyncAction(async () => { tests.setData(await api.post<DataTest[]>(`${base}/run`)); });
  const [remove] = useAsyncAction(async (id: string) => { await api.del(`${base}/${id}`); tests.reload(); });

  if (tests.loading) return <Loading compact />;
  const list = tests.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Tests run after every refresh. If a "roll back" test fails, the previous data is put back and you get a notification.
        </p>
        {list.length > 0 && <Button variant="secondary" label={runState.busy ? 'Running…' : 'Run now'} icon={<Play className="size-4" />} onClick={() => runAll()} isDisabled={runState.busy} />}
      </div>
      <ErrorBanner message={tests.error || addState.error || runState.error} />
      <AddTestForm columns={columns} onAdd={add} busy={addState.busy} />
      {list.length === 0 && <p className="text-sm text-muted-foreground">No tests yet. Start with “No duplicates” on your ID column.</p>}
      <ul className="divide-y rounded-lg border">
        {list.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Badge variant={t.last_status === 'pass' ? 'success' : t.last_status === 'fail' ? 'error' : 'neutral'} label={t.last_status ?? 'not run'} />
              <span className="truncate">{t.label}</span>
              <span className="truncate text-muted-foreground">· {t.last_detail} · {t.severity === 'error' ? 'rolls back' : 'warns'}</span>
            </span>
            <Button variant="ghost" label="" aria-label="Delete test" icon={<Trash2 className="size-4" />} onClick={() => remove(t.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
