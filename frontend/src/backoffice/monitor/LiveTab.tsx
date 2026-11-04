import { AsyncView } from '@/components/common/AsyncView';
import { ago, bytes, num } from '../format';
import { StatGrid, StatTile } from '../parts/StatTile';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { ActivityTable } from '../parts/ActivityTable';
import { SeriesChart, right, usePoll, type Row } from './charts';

export const uptime = (s: number) => `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

/** Real-time: polls /admin/monitor/live every 5 s. */
export function LiveTab({ paused, onUser }: { paused: boolean; onUser: (id: string) => void }) {
  const state = usePoll<Row>('/admin/monitor/live', 5000, !paused);
  return (
    <AsyncView state={state}>{(l) => {
      const n = l.now, err = n.req_60m ? (100 * (n.err5_60m + n.err4_60m)) / n.req_60m : 0;
      return (
        <div className="flex flex-col gap-3">
          <StatGrid>
            <StatTile label="In flight now" value={num(l.inflight)} hint={`up ${uptime(l.uptime_s)}`} />
            <StatTile label="Requests / min" value={num(n.req_1m)} hint={`${num(n.req_5m)} in 5 min · ${num(n.req_60m)} in 1 h`} />
            <StatTile label="Users online" value={num(n.users_5m)} hint={`${num(n.users_15m)} in 15 min · ${num(n.ips_15m)} IPs`} />
            <StatTile label="Latency p95 (1 h)" value={`${n.p95 ?? '—'} ms`} hint={`p50 ${n.p50 ?? '—'} · p99 ${n.p99 ?? '—'} · max ${n.max_ms ?? '—'}`}
              tone={n.p95 > 2000 ? 'bad' : undefined} />
            <StatTile label="Error rate (1 h)" value={`${err.toFixed(1)}%`} hint={`${num(n.err5_60m)} 5xx · ${num(n.err4_60m)} 4xx`}
              tone={n.err5_60m ? 'bad' : undefined} />
            <StatTile label="AI calls (1 h)" value={num(l.ai_60m.calls)} hint={`${num(l.ai_60m.tokens)} tokens · ${num(l.ai_60m.errors)} failed`} />
            <StatTile label="CPU" value={l.host.cpu_pct == null ? '—' : `${l.host.cpu_pct}%`} hint={l.host.load ? `load ${l.host.load.map((x: number) => x.toFixed(2)).join(' ')}` : undefined} />
            <StatTile label="Memory" value={l.host.mem.total ? `${Math.round((100 * l.host.mem.used) / l.host.mem.total)}%` : '—'}
              hint={`process ${bytes(l.host.process.rss)}`} />
            <StatTile label="Disk" value={`${Math.round((100 * l.disk.used) / l.disk.total)}%`} hint={`${bytes(l.disk.free)} free`} />
            <StatTile label="Network" value={l.host.net.rx_rate == null ? '—' : `${bytes(l.host.net.rx_rate)}/s`} hint={l.host.net.tx_rate == null ? undefined : `out ${bytes(l.host.net.tx_rate)}/s`} />
            <StatTile label="Threads" value={num(l.host.process.threads)} hint={l.host.process.open_files != null ? `${l.host.process.open_files} open files` : undefined} />
            <StatTile label="Users (1 h)" value={num(n.users_60m)} />
          </StatGrid>
          <div className="grid gap-3 lg:grid-cols-2">
            <SeriesChart title="Requests per minute" description="last 60 minutes" data={l.per_minute} x="time" bars
              series={[{ key: 'requests', label: 'Requests' }, { key: 'errors', label: 'Errors' }]} />
            <SeriesChart title="Latency p95 per minute" description="ms, last 60 minutes" data={l.per_minute} x="time" unit=""
              series={[{ key: 'p95', label: 'p95 ms' }, { key: 'users', label: 'Users' }]} />
          </div>
          <Section title="Who is online" description="users with a request in the last 15 minutes · click for details">
            <SimpleTable rows={l.online as Row[]} onRow={(r) => onUser(r.user_id)} empty="Nobody right now." cols={[
              { label: 'User', cell: (r) => r.email ?? r.user_id },
              { label: 'Last seen', cell: (r) => ago(r.last_seen) },
              { label: 'Doing', cell: (r) => <span className="font-mono text-xs">{r.last_path}</span> },
              { label: 'Requests', cell: (r) => num(r.requests), className: right },
              { label: 'Errors', cell: (r) => num(r.errors), className: right },
            ]} />
          </Section>
          <Section title="Live request stream" description="newest first, refreshes every 5 s">
            <ActivityTable rows={l.stream} />
          </Section>
        </div>
      );
    }}</AsyncView>
  );
}
