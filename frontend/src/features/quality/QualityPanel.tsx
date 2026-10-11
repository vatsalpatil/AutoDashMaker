import { Button, Card } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { QualityRun } from '@/lib/types';
import { QualityBadge } from '@/pages/QualityBadge';

type ColumnStat = { name: string; null_pct: number; distinct: number };
const SCORES = ['completeness', 'uniqueness', 'validity'] as const;

/** Latest data-quality scores for a dataset (history comes newest first), with a per-column breakdown and the change vs the run before. */
export function QualityPanel({ datasetId }: { datasetId: string }) {
  const { data: runs, loading, error, reload } = useApi<QualityRun[]>(`/quality/dataset/${datasetId}`);
  const [run, { busy, error: runError }] = useAsyncAction(async () => { await api.post(`/quality/run/${datasetId}`); reload(); });

  const [latest, previous] = runs ?? [];
  const columns = ((latest?.details as { columns?: ColumnStat[] } | undefined)?.columns ?? [])
    .slice().sort((a, b) => b.null_pct - a.null_pct);
  const delta = (k: (typeof SCORES)[number]) => {
    const d = latest && previous ? Number(latest[k]) - Number(previous[k]) : NaN;
    return Number.isFinite(d) && d !== 0 ? <span className={d > 0 ? 'text-success' : 'text-destructive'}>{d > 0 ? '▲' : '▼'} {Math.abs(Math.round(d * 10) / 10)}</span> : null;
  };

  return (
    <Card padding={4}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Data quality</h3>
          {latest?.created_at && <p className="text-xs text-muted-foreground">Last checked {new Date(String(latest.created_at)).toLocaleString()} · {runs!.length} run{runs!.length === 1 ? '' : 's'}</p>}
        </div>
        <Button variant="primary" label={busy ? 'Checking…' : latest ? 'Run again' : 'Run check'} onClick={() => run()} isDisabled={busy} />
      </div>
      <ErrorBanner message={runError ?? error} />
      {loading && !runs && <Loading compact />}
      {!loading && !latest && !error && <p className="mt-3 text-sm text-muted-foreground">No quality check yet. Run one to score completeness, uniqueness and validity. Large or live tables are sampled (first 100,000 rows).</p>}
      {latest && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {SCORES.map((k) => (
              <div key={k} className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">{k}</div>
                <div className="mt-1 flex items-center gap-2"><QualityBadge value={latest[k]} /><span className="text-xs">{delta(k)}</span></div>
              </div>
            ))}
            <Stat label="Duplicates" value={`${latest.duplicate_pct ?? 0}%`} />
            <Stat label="Freshness" value={String(latest.freshness ?? '—')} />
            <Stat label="Rows" value={latest.row_count?.toLocaleString() ?? '—'} />
          </div>
          {columns.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1fr_6rem_6rem] border-b bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                <span>Column</span><span className="text-right">Empty</span><span className="text-right">Distinct</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {columns.map((c) => (
                  <div key={c.name} className="grid grid-cols-[1fr_6rem_6rem] items-center border-b px-3 py-1.5 text-sm last:border-b-0">
                    <span className="mono truncate">{c.name}</span>
                    <span className={`text-right ${c.null_pct > 20 ? 'text-destructive' : c.null_pct > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{c.null_pct}%</span>
                    <span className="text-right text-muted-foreground">{c.distinct?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-3"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}
