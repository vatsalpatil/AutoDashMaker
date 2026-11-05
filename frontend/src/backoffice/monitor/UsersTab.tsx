import { useState } from 'react';
import { Download } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { Badge, Button, TextInput } from '@/components/ui/kit';
import { ago, num } from '../format';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { StatGrid, StatTile } from '../parts/StatTile';
import { downloadCsv, useSearch } from '../parts/useAdmin';
import { right, type Row } from './charts';
import { country } from './LocationsTab';

/** Every user active in the window with traffic, quality, AI and content numbers. */
export function UsersTab({ query, onUser }: { query: string; onUser: (id: string) => void }) {
  const state = useApi<Row[]>(`/admin/monitor/users?${query}`);
  const [q, setQ] = useState('');
  const rows = useSearch(state.data, q, ['email', 'user_id', 'device', 'browser']);
  return (
    <AsyncView state={state}>{(all) => {
      const sum = (k: string) => all.reduce((a, r) => a + (Number(r[k]) || 0), 0);
      return (
        <div className="flex flex-col gap-3">
          <StatGrid>
            <StatTile label="Active users" value={num(all.length)} />
            <StatTile label="Requests" value={num(sum('requests'))} hint={all.length ? `${num(Math.round(sum('requests') / all.length))} per user` : undefined} />
            <StatTile label="AI calls" value={num(sum('ai_calls'))} hint={`${num(sum('ai_tokens'))} tokens`} />
            <StatTile label="Errors hit" value={num(sum('errors'))} />
            <StatTile label="Power users" value={num(all.filter((r) => r.active_days >= 3).length)} hint="active 3+ days" />
            <StatTile label="One-day users" value={num(all.filter((r) => r.active_days === 1).length)} />
          </StatGrid>
          <Section title="Per-user usage" description="click a user for the full timeline, sessions, routes, AI and devices"
            actions={<>
              <TextInput aria-label="Search users" placeholder="Search email, device…" value={q} onChange={setQ} className="w-56" />
              <Button size="sm" icon={<Download className="size-4" />} label="CSV" onClick={() => downloadCsv('user-usage', rows)} />
            </>}>
            <SimpleTable rows={rows} onRow={(r) => onUser(r.user_id)} cols={[
              { label: 'User', cell: (r) => <div className="max-w-56 truncate">{r.email ?? r.user_id}</div> },
              { label: 'Last seen', cell: (r) => ago(r.last_seen), className: 'whitespace-nowrap' },
              { label: 'Days', cell: (r) => num(r.active_days), className: right },
              { label: 'Requests', cell: (r) => num(r.requests), className: right },
              { label: 'Errors', cell: (r) => r.errors ? <Badge variant={r.error_rate > 10 ? 'error' : 'warning'} label={`${r.errors} · ${r.error_rate}%`} /> : '0', className: right },
              { label: 'p95', cell: (r) => `${r.p95} ms`, className: right },
              { label: 'Areas', cell: (r) => num(r.areas), className: right },
              { label: 'AI calls', cell: (r) => num(r.ai_calls), className: right },
              { label: 'Tokens', cell: (r) => num(r.ai_tokens), className: right },
              { label: 'Datasets', cell: (r) => num(r.datasets), className: right },
              { label: 'Dashboards', cell: (r) => num(r.dashboards), className: right },
              { label: 'Location', cell: (r) => <span className="whitespace-nowrap text-xs">{country(r.country)}{r.city ? ` · ${r.city}` : ''}</span> },
              { label: 'Device', cell: (r) => <span className="whitespace-nowrap text-xs">{r.device} · {r.browser}</span> },
              { label: 'IPs', cell: (r) => num(r.ips), className: right },
            ]} />
          </Section>
        </div>
      );
    }}</AsyncView>
  );
}
