import { useState } from 'react';
import { downloadFile } from '@/lib/auth';
import { ChevronDown, ChevronUp, Download, Play, Trash2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { Badge, Button, Card } from '@/components/ui/kit';
import { StatusBadge } from '@/features/alerts/alertOps';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Report, ReportRun } from './types';

const every = (m: number) => (m % 10080 === 0 ? `${m / 10080} week(s)` : m % 1440 === 0 ? `${m / 1440} day(s)` : m % 60 === 0 ? `${m / 60} hour(s)` : `${m} min`);

/** One scheduled report: status, run now / pause / delete, and its last runs with CSV downloads. */
export function ReportCard({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<ReportRun[] | null>(null);
  const [runNow, run] = useAsyncAction(async () => {
    await api.post(`/reports/${report.id}/run`);
    if (open) setRuns(await api.get<ReportRun[]>(`/reports/${report.id}/runs`));
    onChanged();
  });
  const [toggle, tog] = useAsyncAction(async () => { await api.patch(`/reports/${report.id}`, { ...report, active: !report.active }); onChanged(); });
  const [remove, del] = useAsyncAction(async () => {
    if (!window.confirm(`Delete report "${report.name}" and its saved files?`)) return;
    await api.del(`/reports/${report.id}`);
    onChanged();
  });
  const [toggleRuns, hist] = useAsyncAction(async () => {
    if (!open) setRuns(await api.get<ReportRun[]>(`/reports/${report.id}/runs`));
    setOpen((o) => !o);
  });
  const error = run.error ?? tog.error ?? del.error ?? hist.error;

  return (
    <Card padding={4}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{report.name}</span>
            <StatusBadge status={report.last_status === 'never' ? undefined : report.last_status} />
            {!report.active && <Badge variant="neutral" label="paused" />}
            {report.webhook_url && <Badge variant="neutral" label="webhook" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Every {every(report.schedule_minutes)}{report.last_run_at ? ` · last run ${new Date(report.last_run_at).toLocaleString()} (${report.last_rows ?? 0} rows)` : ' · not run yet'}</p>
          <p className="mono mt-1 line-clamp-1 text-xs text-muted-foreground" title={report.sql}>{report.sql}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" label={run.busy ? 'Running…' : 'Run now'} icon={<Play className="size-4" />} onClick={() => runNow()} isDisabled={run.busy} />
          <Button variant="secondary" label={report.active ? 'Pause' : 'Activate'} onClick={() => toggle()} />
          <Button variant="secondary" label={open ? 'Hide runs' : 'Runs'} icon={open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} onClick={() => toggleRuns()} />
          <button onClick={() => remove()} className="rounded-md p-2 text-muted-foreground hover:text-destructive" aria-label="Delete report"><Trash2 className="size-4" /></button>
        </div>
      </div>
      <ErrorBanner message={error} />
      {open && (
        <div className="mt-3 overflow-auto rounded-lg border">
          {!runs ? <Loading compact /> : runs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No runs yet.</p> : (
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted"><tr>{['Time', 'Status', 'Rows', 'Message', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-1.5">{r.row_count}</td>
                    <td className="max-w-xs truncate px-3 py-1.5 text-muted-foreground" title={r.message}>{r.message}</td>
                    <td className="px-3 py-1.5 text-right">{r.file_name && <button onClick={() => void downloadFile(`/api/reports/runs/${r.id}/download`, r.file_name ?? 'report.csv')} className="inline-flex items-center gap-1 text-primary hover:underline"><Download className="size-3.5" /> CSV</button>}</td>
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
