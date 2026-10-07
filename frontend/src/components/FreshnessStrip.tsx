import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, TextInput } from '@/components/ui/kit';
import { RefreshCw } from 'lucide-react';
import { useDatasetRefresh } from '@/hooks/useDatasetRefresh';
import { api } from '@/lib/api';
import type { FreshnessStatus } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';

export function FreshnessStrip({ datasetId, onRefreshed }: { datasetId: string; onRefreshed?: () => void }) {
  const [fresh, setFresh] = useState<FreshnessStatus | null>(null);
  const [interval, setInterval_] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dismissedRefreshError, setDismissedRefreshError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const refresher = useDatasetRefresh(() => { load(); onRefreshed?.(); });
  const job = refresher.state[datasetId];
  const busy = !!job?.running;

  const load = useCallback(() => {
    api.get<FreshnessStatus>(`/datasets/${datasetId}/freshness`)
      .then((f) => {
        setFresh(f);
        setInterval_(f.expected_interval_minutes != null ? String(f.expected_interval_minutes) : '');
        setAutoRefresh(!!f.auto_refresh);
      })
      .catch(() => {});
  }, [datasetId]);
  useEffect(load, [load]);
  useEffect(() => { refresher.resume(datasetId); }, [datasetId]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/datasets/${datasetId}/freshness`, {
        expected_interval_minutes: interval.trim() === '' ? null : Number(interval),
        auto_refresh: autoRefresh,
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const refresh = () => { setError(null); refresher.start(datasetId); };

  if (!fresh) return null;

  const refreshError = fresh.last_refresh_error && fresh.last_refresh_error !== dismissedRefreshError
    ? `Last auto-refresh failed: ${fresh.last_refresh_error}` : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm ">
        <span className="text-muted-foreground">Updated {fresh.last_updated}</span>
        {fresh.status === 'fresh' && <Badge variant="green" label="fresh" />}
        {fresh.status === 'stale' && <Badge variant="red" label="stale" />}
        {fresh.status === 'unconfigured' && <Badge variant="neutral" label="unconfigured" />}
        <span className="flex items-center gap-2 text-muted-foreground">
          Expect updates every
          <span className="w-20">
            <TextInput label="" value={interval} onChange={setInterval_} placeholder="—" aria-label="Expected interval in minutes" />
          </span>
          minutes
        </span>
        <label className="flex items-center gap-1.5 text-muted-foreground" title="Re-import from the source automatically whenever the interval elapses">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh
        </label>
        <Button variant="secondary" label={saving ? 'Saving…' : 'Save'} onClick={save} isDisabled={saving} />
        <Button variant="secondary" label={busy ? `Refreshing… ${Math.round(job?.elapsed ?? 0)}s` : 'Refresh now'} icon={<RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />} onClick={refresh} isDisabled={busy} />
      </div>
      <ErrorBanner message={error ?? job?.error ?? refreshError} onDismiss={() => { setError(null); setDismissedRefreshError(fresh.last_refresh_error ?? null); }} />
    </div>
  );
}
