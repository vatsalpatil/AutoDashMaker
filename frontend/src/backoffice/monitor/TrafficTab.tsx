import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { Badge } from '@/components/ui/kit';
import { ago, num } from '../format';
import { StatGrid, StatTile } from '../parts/StatTile';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { ActivityTable } from '../parts/ActivityTable';
import { BarList, Heatmap, SeriesChart, right, type Row } from './charts';

const route = (r: Row) => <span className="font-mono text-xs"><b>{r.method}</b> {r.route}</span>;

/** Traffic + API performance over a window (hours). */
export function TrafficTab({ query }: { query: string }) {
  const state = useApi<Row>(`/admin/monitor/traffic?${query}`);
  return (
    <AsyncView state={state}>{(t) => (
      <div className="flex flex-col gap-3">
        <StatGrid>
          <StatTile label="Requests" value={num(t.totals.requests)} />
          <StatTile label="Users" value={num(t.totals.users)} hint={`${num(t.totals.ips)} IP addresses`} />
          <StatTile label="Avg latency" value={`${t.totals.avg_ms ?? '—'} ms`} hint={`p95 ${t.totals.p95 ?? '—'} ms`} />
          <StatTile label="Server errors" value={num(t.totals.err5)} tone={t.totals.err5 ? 'bad' : undefined} />
          <StatTile label="Client errors" value={num(t.totals.err4)} />
          <StatTile label="Success rate" value={t.totals.requests ? `${(100 - (100 * (t.totals.err5 + t.totals.err4)) / t.totals.requests).toFixed(1)}%` : '—'} />
        </StatGrid>
        <div className="grid gap-3 lg:grid-cols-2">
          <SeriesChart title="Requests & users" data={t.series} x="time" series={[{ key: 'requests', label: 'Requests' }, { key: 'users', label: 'Users' }]} />
          <SeriesChart title="Errors & p95 latency" data={t.series} x="time" series={[{ key: 'errors', label: 'Errors' }, { key: 'p95', label: 'p95 ms' }]} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BarList title="Status codes" rows={t.status} />
          <BarList title="Methods" rows={t.methods} />
          <BarList title="Devices" rows={t.devices} extra={(r) => `· ${r.users} users`} />
          <BarList title="Clients" rows={t.browsers} extra={(r) => `· ${r.users} users`} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <BarList title="Product areas" description="requests by /api/<area>" rows={t.areas} extra={(r) => `· ${r.users} users`} />
          <Heatmap rows={t.heatmap} />
        </div>
        <Section title="Endpoints" description="every route, busiest first: volume, failures, speed">
          <SimpleTable rows={t.routes as Row[]} cols={[
            { label: 'Route', cell: route },
            { label: 'Calls', cell: (r) => num(r.n), className: right },
            { label: 'Errors', cell: (r) => r.errors ? <Badge variant="warning" label={num(r.errors)} /> : '0', className: right },
            { label: 'Avg', cell: (r) => `${r.avg_ms} ms`, className: right },
            { label: 'p95', cell: (r) => `${r.p95} ms`, className: right },
            { label: 'Max', cell: (r) => `${r.max_ms} ms`, className: right },
          ]} />
        </Section>
        <div className="grid gap-3 xl:grid-cols-2">
          <Section title="Failing routes">
            <SimpleTable rows={t.error_routes as Row[]} empty="No failures." cols={[
              { label: 'Route', cell: route },
              { label: 'Status', cell: (r) => <Badge variant={r.status >= 500 ? 'error' : 'warning'} label={r.status} /> },
              { label: 'Count', cell: (r) => num(r.n), className: right },
              { label: 'Last', cell: (r) => ago(r.last_at) },
            ]} />
          </Section>
          <Section title="Top IP addresses">
            <SimpleTable rows={t.ips as Row[]} cols={[
              { label: 'IP', cell: (r) => <span className="font-mono text-xs">{r.ip}</span> },
              { label: 'User', cell: (r) => r.email ?? '—' },
              { label: 'Requests', cell: (r) => num(r.n), className: right },
              { label: 'Users', cell: (r) => num(r.users), className: right },
              { label: 'Errors', cell: (r) => num(r.errors), className: right },
            ]} />
          </Section>
        </div>
        <Section title="Slowest requests"><ActivityTable rows={t.slowest} /></Section>
      </div>
    )}</AsyncView>
  );
}
