import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { Button } from '@/components/ui/kit';
import { ago, num } from '../format';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { StatGrid, StatTile } from '../parts/StatTile';
import { ActivityTable } from '../parts/ActivityTable';
import { BarList, SeriesChart, right, type Row } from './charts';

/** Everything one user did: timeline, sessions, areas, routes, AI, devices, errors. */
export function UserDrill({ id, days, onBack }: { id: string; days: string; onBack: () => void }) {
  const state = useApi<Row>(`/admin/monitor/users/${encodeURIComponent(id)}?days=${days}`);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<ArrowLeft className="size-4" />} label="All users" onClick={onBack} />
        <Link to={`/users/${encodeURIComponent(id)}`} className="flex items-center gap-1 text-sm underline">Account & controls <ExternalLink className="size-3" /></Link>
      </div>
      <AsyncView state={state}>{(u) => {
        const t = u.totals, hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, n: u.hours.find((x: Row) => x.hour === h)?.n ?? 0 }));
        const mins = u.sessions.map((s: Row) => s.minutes as number);
        return (
          <>
            <div className="text-lg font-semibold">{t.email ?? id}</div>
            <StatGrid>
              <StatTile label="Requests" value={num(t.requests)} hint={`${num(t.active_days)} active days`} />
              <StatTile label="Errors" value={num(t.errors)} tone={t.errors ? 'bad' : undefined} hint={t.requests ? `${((100 * t.errors) / t.requests).toFixed(1)}%` : undefined} />
              <StatTile label="Latency" value={`${t.avg_ms ?? '—'} ms`} hint={`p95 ${t.p95 ?? '—'} ms`} />
              <StatTile label="Sessions" value={num(u.sessions.length)} hint={mins.length ? `avg ${(mins.reduce((a: number, b: number) => a + b, 0) / mins.length).toFixed(1)} min` : undefined} />
              <StatTile label="First seen" value={ago(t.first_seen)} />
              <StatTile label="Last seen" value={ago(t.last_seen)} />
            </StatGrid>
            <StatGrid>
              {Object.entries(u.content as Record<string, number>).map(([k, v]) => <StatTile key={k} label={k} value={num(v)} />)}
            </StatGrid>
            <div className="grid gap-3 lg:grid-cols-2">
              <SeriesChart title="Daily activity" data={u.daily} x="day" bars series={[{ key: 'requests', label: 'Requests' }, { key: 'errors', label: 'Errors' }]} />
              <SeriesChart title="Hour of day (UTC)" data={hours} x="hour" bars series={[{ key: 'n', label: 'Requests' }]} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <BarList title="Product areas used" rows={u.areas} />
              <Section title="AI usage">
                <SimpleTable rows={u.ai as Row[]} empty="No AI calls." cols={[
                  { label: 'Feature', cell: (r) => r.feature }, { label: 'Model', cell: (r) => <span className="text-xs">{r.model}</span> },
                  { label: 'Calls', cell: (r) => num(r.calls), className: right }, { label: 'Tokens', cell: (r) => num(r.tokens), className: right },
                  { label: 'Failed', cell: (r) => num(r.errors), className: right },
                ]} />
              </Section>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Section title="Sessions" description="a new session starts after 30 idle minutes">
                <SimpleTable rows={u.sessions as Row[]} cols={[
                  { label: 'Started', cell: (r) => <span title={r.start}>{ago(r.start)}</span> },
                  { label: 'Minutes', cell: (r) => r.minutes, className: right }, { label: 'Requests', cell: (r) => num(r.requests), className: right },
                ]} />
              </Section>
              <Section title="Devices & IPs">
                <SimpleTable rows={u.ips as Row[]} cols={[
                  { label: 'IP', cell: (r) => <span className="font-mono text-xs">{r.ip}</span> }, { label: 'Client', cell: (r) => `${r.device} · ${r.browser}` },
                  { label: 'Requests', cell: (r) => num(r.n), className: right }, { label: 'Last', cell: (r) => ago(r.last_at) },
                ]} />
              </Section>
            </div>
            <Section title="Top routes">
              <SimpleTable rows={u.routes as Row[]} cols={[
                { label: 'Route', cell: (r) => <span className="font-mono text-xs"><b>{r.method}</b> {r.route}</span> },
                { label: 'Calls', cell: (r) => num(r.n), className: right }, { label: 'Errors', cell: (r) => num(r.errors), className: right },
                { label: 'Avg', cell: (r) => `${r.avg_ms} ms`, className: right },
              ]} />
            </Section>
            {u.errors.length > 0 && <Section title="Errors this user hit"><ActivityTable rows={u.errors} showUser={false} /></Section>}
            <Section title="Recent requests"><ActivityTable rows={u.recent} showUser={false} /></Section>
          </>
        );
      }}</AsyncView>
    </div>
  );
}
