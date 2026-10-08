import { Eraser, RefreshCw } from 'lucide-react';
import { AsyncView } from '@/components/common/AsyncView';
import { Badge, Button, Card } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SystemInfo } from '@/lib/types';

const uptime = (s: number) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} d`);

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" title={hint}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Live health of this workspace: storage against the upload limit, engine limits, query cache, and what it holds. */
export default function SystemSettings() {
  const sys = useApi<SystemInfo>('/system');
  const [clear, { busy }] = useAsyncAction(async () => { await api.post('/system/cache/clear', {}); sys.reload(); });
  return (
    <AsyncView state={sys}>
      {(s) => {
        const over = s.disk.limit_pct > 0 && s.disk.used_pct > s.disk.limit_pct;
        return (
          <div className="flex flex-col gap-4">
            <Card padding={4}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">Status</h2>
                <Badge label="Backend online" />
                <Badge label={s.auth_enabled ? 'Sign-in required' : 'Local mode (no login)'} />
                <Button size="sm" className="ml-auto" label="Refresh" icon={<RefreshCw className="size-3.5" />} onClick={sys.reload} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="App" value={`${s.app} v${s.version}`} />
                <Stat label="Uptime" value={uptime(s.uptime_s)} />
                <Stat label="Python" value={s.python} />
                <Stat label="Workspace" value={<span className="text-sm">{s.workspace}</span>} />
              </div>
            </Card>

            <Card padding={4}>
              <h2 className="mb-1 font-semibold">Storage</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                New uploads and imports are refused once the disk passes {s.disk.limit_pct}% full.
                {over && <b className="text-destructive"> The disk is over the limit now: delete unused datasets or files.</b>}
              </p>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', over ? 'bg-destructive' : 'bg-primary')} style={{ width: `${s.disk.used_pct}%` }} />
                {s.disk.limit_pct > 0 && <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${s.disk.limit_pct}%` }} title="Upload limit" />}
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{s.disk.used_pct}% used</span><span>{s.disk.free_gb} GB free of {s.disk.total_gb} GB</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Analytics data" value={`${s.files.analytics_mb} MB`} hint="Your dataset tables (DuckDB file)" />
                <Stat label="Metadata" value={`${s.files.metadata_mb} MB`} hint="Charts, dashboards, queries, settings" />
                <Stat label="Uploaded files" value={`${s.files.uploads_mb} MB`} />
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card padding={4}>
                <h2 className="mb-3 font-semibold">Engine limits</h2>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                  {([['Memory', s.limits.memory], ['Threads', s.limits.threads], ['Query timeout', `${s.limits.query_timeout_s} s`],
                    ['Default row limit', s.limits.default_row_limit.toLocaleString()], ['Max upload', `${s.limits.max_upload_mb} MB`]] as const).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Set in <code>backend/.env</code> (DUCKDB_MEMORY_LIMIT, DUCKDB_THREADS, …).</p>
              </Card>
              <Card padding={4}>
                <h2 className="mb-1 font-semibold">Query cache</h2>
                <p className="mb-3 text-sm text-muted-foreground">Repeat queries are served from memory for {s.cache.ttl_s / 60} min, and dropped whenever data changes.</p>
                <div className="mb-3 text-2xl font-semibold tabular-nums">{s.cache.entries}<span className="text-sm font-normal text-muted-foreground"> / {s.cache.max} results</span></div>
                <Button label={busy ? 'Clearing…' : 'Clear cache'} icon={<Eraser className="size-4" />} onClick={() => clear()} isDisabled={busy || s.cache.entries === 0} />
              </Card>
            </div>

            <Card padding={4}>
              <h2 className="mb-3 font-semibold">In this workspace</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(s.counts).map(([k, n]) => <Stat key={k} label={k[0].toUpperCase() + k.slice(1)} value={n} />)}
              </div>
            </Card>
          </div>
        );
      }}
    </AsyncView>
  );
}
