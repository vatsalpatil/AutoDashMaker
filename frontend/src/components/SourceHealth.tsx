import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui/kit';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { SourceHealthItem } from '@/lib/types';

/** Live connectivity of every saved source, plus auto-refresh state and the last refresh error. */
export function SourceHealth() {
  const [items, setItems] = useState<SourceHealthItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    api.get<{ sources: SourceHealthItem[] }>('/sources/health')
      .then((r) => setItems(r.sources))
      .catch(() => setItems([]))
      .finally(() => setBusy(false));
  }, []);
  useEffect(load, [load]);

  if (items === null || items.length === 0) return null;
  const down = items.filter((s) => s.connection && !s.connection.ok).length;

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Connection health</h2>
            <Badge variant={down ? 'red' : 'green'} label={down ? `${down} unreachable` : 'all reachable'} />
          </div>
          <Button variant="secondary" label={busy ? 'Checking…' : 'Re-check'} isDisabled={busy}
            icon={<RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />} onClick={load} />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((s) => (
            <li key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{s.name}</span>
                {s.connection
                  ? <Badge variant={s.connection.ok ? 'green' : 'red'} label={s.connection.ok ? 'online' : 'offline'} />
                  : <Badge variant="neutral" label="unchecked" />}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.type} · {s.dataset_count} dataset{s.dataset_count === 1 ? '' : 's'}
                {s.connection?.latency_ms != null && ` · ${Math.round(s.connection.latency_ms)} ms`}
                {s.auto_refresh_datasets > 0 && ` · ${s.auto_refresh_datasets} auto-refreshing`}
              </div>
              {s.connection && !s.connection.ok && s.connection.detail && (
                <div className="mt-1 text-xs text-destructive">{s.connection.detail}</div>
              )}
              {s.last_refresh_error && (
                <div className="mt-1 text-xs text-warning">Last refresh failed: {s.last_refresh_error}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
