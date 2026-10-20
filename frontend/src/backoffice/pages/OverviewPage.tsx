import { RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, Card } from '@/components/ui/kit';
import { bytes, num } from '../format';
import type { Overview } from '../types';
import { StatGrid, StatTile } from '../parts/StatTile';
import { TrendChart } from '../parts/TrendChart';
import { SimpleTable } from '../parts/SimpleTable';
import { ActivityTable } from '../parts/ActivityTable';

export function OverviewPage() {
  const state = useApi<Overview>('/admin/overview');
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Overview" description="The whole platform at a glance: every user, every workspace."
        actions={<Button size="sm" icon={<RefreshCw className="size-4" />} label="Refresh" onClick={state.reload} />} />
      <AsyncView state={state}>{(o) => {
        const diskPct = Math.round((o.disk.used / o.disk.total) * 100);
        return (
          <>
            <StatGrid>
              <StatTile label="Active users (24h)" value={num(o.activity.users_24h)} hint={`${num(o.activity.users_7d)} in 7 days`} />
              <StatTile label="Requests (24h)" value={num(o.activity.requests_24h)} hint={`p95 ${o.activity.p95_ms_24h ?? '—'} ms`} />
              <StatTile label="Server errors (24h)" value={num(o.activity.errors_24h)} tone={o.activity.errors_24h ? 'bad' : undefined} />
              <StatTile label="AI calls (24h)" value={num(o.ai.calls_24h)} hint={`${num(o.ai.tokens_24h)} tokens · ${num(o.ai.errors_24h)} failed`} />
              <StatTile label="Disk used" value={`${diskPct}%`} hint={`${bytes(o.disk.free)} free of ${bytes(o.disk.total)}`} tone={diskPct > 85 ? 'bad' : undefined} />
              <StatTile label="Workspaces with data" value={num(o.workspaces)} />
            </StatGrid>
            <StatGrid>
              {Object.entries(o.totals).map(([k, v]) => <StatTile key={k} label={k.replace('_', ' ')} value={num(v)} />)}
            </StatGrid>
            <div className="grid gap-3 lg:grid-cols-2">
              <TrendChart title="Requests & users, last 14 days" data={o.daily} series={[{ key: 'requests', label: 'Requests' }, { key: 'users', label: 'Users' }]} />
              <TrendChart title="AI calls, last 14 days" data={o.ai_daily} series={[{ key: 'calls', label: 'Calls' }]} />
            </div>
            <Card>
              <div className="mb-2 text-sm font-medium">Busiest routes (24h)</div>
              <SimpleTable rows={o.top_paths} cols={[
                { label: 'Route', cell: (r) => <span className="font-mono text-xs"><b>{r.method}</b> {r.route}</span> },
                { label: 'Calls', cell: (r) => num(r.n), className: 'text-right tabular-nums' },
                { label: 'Avg', cell: (r) => `${r.avg_ms} ms`, className: 'text-right tabular-nums' },
              ]} />
            </Card>
            <Card>
              <div className="mb-2 text-sm font-medium">Recent server errors</div>
              <ActivityTable rows={o.recent_errors} />
            </Card>
          </>
        );
      }}</AsyncView>
    </div>
  );
}
