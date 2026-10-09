import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, Trash2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { Badge, Button, Card } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Alert, AlertRun, AlertRunResult } from '@/lib/types';
import { StatusBadge, opLabel } from './alertOps';

/** One alert: status, last value, run / pause / delete, and its run history. */
export function AlertCard({ alert, datasetName, onChanged }: { alert: Alert; datasetName?: string; onChanged: () => void }) {
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<AlertRun[] | null>(null);

  const [runNow, run] = useAsyncAction(async () => {
    setRunMsg(null);
    const r = await api.post<AlertRunResult>(`/alerts/${alert.id}/run`);
    setRunMsg(`${r.status.toUpperCase()}: ${r.message ?? `value ${r.value ?? '—'}`}`);
    onChanged();
    setTimeout(() => setRunMsg(null), 8000);
  });
  const [toggle, tog] = useAsyncAction(async () => { await api.post(`/alerts/${alert.id}/toggle`); onChanged(); });
  const [remove, del] = useAsyncAction(async () => {
    if (!window.confirm(`Delete alert "${alert.name}"?`)) return;
    await api.del(`/alerts/${alert.id}`);
    onChanged();
  });
  const [toggleHistory, hist] = useAsyncAction(async () => {
    if (!historyOpen && runs === null) setRuns(await api.get<AlertRun[]>(`/alerts/${alert.id}/runs`));
    setHistoryOpen((o) => !o);
  });
  const error = run.error ?? tog.error ?? del.error ?? hist.error;

  return (
    <Card padding={4}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{alert.name}</span>
            <StatusBadge status={alert.last_status} />
            {!alert.active && <Badge variant="neutral" label="paused" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {datasetName ?? alert.dataset_id} — {opLabel(alert.operator)} {alert.threshold} · every {alert.schedule_minutes} min
          </p>
          {alert.last_value != null && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Last value: <span className="font-medium text-foreground">{alert.last_value}</span>
              {alert.last_run_at && <span className="text-xs"> · {new Date(alert.last_run_at).toLocaleString()}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" label={run.busy ? 'Running…' : 'Run now'} icon={<Play className="size-4" />} onClick={() => runNow()} isDisabled={run.busy} />
          <Button variant="secondary" label={alert.active ? 'Pause' : 'Activate'} onClick={() => toggle()} />
          <Button variant="secondary" label={historyOpen ? 'Hide history' : 'History'} icon={historyOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} onClick={() => toggleHistory()} />
          <button onClick={() => remove()} className="rounded-md p-2 text-muted-foreground hover:text-destructive" aria-label="Delete alert"><Trash2 className="size-4" /></button>
        </div>
      </div>
      {runMsg && <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">{runMsg}</p>}
      <ErrorBanner message={error} />
      {historyOpen && (
        <div className="mt-3 overflow-auto rounded-lg border">
          {!runs ? <Loading compact /> : runs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No runs yet.</p> : (
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted"><tr>{['Time', 'Value', 'Status', 'Message'].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5">{new Date(r.ran_at ?? r.created_at ?? '').toLocaleString()}</td>
                    <td className="px-3 py-1.5">{r.value ?? '—'}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                    <td className="max-w-xs truncate px-3 py-1.5 text-muted-foreground">{r.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}
