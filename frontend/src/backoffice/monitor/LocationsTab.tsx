import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { ago, num } from '../format';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { StatGrid, StatTile } from '../parts/StatTile';
import { BarList, SeriesChart, right, type Row } from './charts';

const names = new Intl.DisplayNames(['en'], { type: 'region' });
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐');
/** "🇮🇳 India" from "IN". */
export function country(cc?: string | null) {
  if (!cc) return '—';
  let name = cc;
  try { name = names.of(cc) ?? cc; } catch { /* not a region code */ }
  return `${flag(cc)} ${name}`;
}
const place = (r: Row) => [r.city, r.region].filter(Boolean).join(', ') || '—';

/** Where users are: countries, cities, each user's usual place, top countries over time. */
export function LocationsTab({ query, onUser }: { query: string; onUser: (id: string) => void }) {
  const state = useApi<Row>(`/admin/monitor/locations?${query}`);
  return (
    <AsyncView state={state}>{(g) => {
      const t = g.totals, top = (g.countries as Row[]).slice(0, 5).map((r) => r.country as string);
      const byDay = new Map<string, Row>();
      for (const r of g.daily as Row[]) if (top.includes(r.country)) byDay.set(r.day, { ...(byDay.get(r.day) ?? { day: r.day }), [r.country]: r.users });
      return (
        <div className="flex flex-col gap-3">
          <StatGrid>
            <StatTile label="Countries" value={num(t.countries)} />
            <StatTile label="Cities" value={num(t.cities)} hint={t.cities ? undefined : 'needs Cloudflare location headers'} />
            <StatTile label="Top country" value={g.countries[0] ? country(g.countries[0].country) : '—'} hint={g.countries[0] && `${num(g.countries[0].users)} users`} />
            <StatTile label="Users located" value={num(g.users.length)} />
            <StatTile label="Travelling users" value={num((g.users as Row[]).filter((u) => u.countries > 1).length)} hint="seen in 2+ countries" />
            <StatTile label="Requests located" value={t.requests ? `${Math.round((100 * t.located) / t.requests)}%` : '—'} hint={`${num(t.located)} of ${num(t.requests)}`} />
          </StatGrid>
          {t.requests > 0 && t.located === 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              No location yet: it is recorded from new requests only, from Cloudflare&apos;s <code>CF-IPCountry</code> header (on by default).
              For city and region, enable Cloudflare → Rules → Managed Transforms → <b>Add visitor location headers</b>.
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList title="Users by country" rows={(g.countries as Row[]).map((r) => ({ ...r, label: country(r.country) }))} value="users"
              extra={(r) => `· ${num(r.requests)} req`} />
            <BarList title="Users by city" rows={(g.cities as Row[]).slice(0, 15).map((r) => ({ ...r, label: `${r.city}, ${r.country}` }))} value="users"
              extra={(r) => `· ${num(r.requests)} req`} />
          </div>
          <SeriesChart title="Daily users, top 5 countries" bars data={[...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))} x="day"
            series={top.map((c) => ({ key: c, label: country(c) }))} />
          <Section title="Countries" description="traffic, quality and speed per country">
            <SimpleTable rows={g.countries as Row[]} cols={[
              { label: 'Country', cell: (r) => country(r.country) },
              { label: 'Users', cell: (r) => num(r.users), className: right },
              { label: 'Requests', cell: (r) => num(r.requests), className: right },
              { label: 'IPs', cell: (r) => num(r.ips), className: right },
              { label: 'Errors', cell: (r) => num(r.errors), className: right },
              { label: 'Avg time', cell: (r) => `${r.avg_ms} ms`, className: right },
              { label: 'Last seen', cell: (r) => ago(r.last_at) },
            ]} />
          </Section>
          <Section title="Where each user is" description="most frequent place in the range · click for the user's details">
            <SimpleTable rows={g.users as Row[]} onRow={(r) => onUser(r.user_id)} cols={[
              { label: 'User', cell: (r) => <div className="max-w-56 truncate">{r.email ?? r.user_id}</div> },
              { label: 'Country', cell: (r) => country(r.country) },
              { label: 'City', cell: place },
              { label: 'Seen in', cell: (r) => <span className="text-xs">{r.seen_in}</span> },
              { label: 'Requests', cell: (r) => num(r.requests), className: right },
              { label: 'Last seen', cell: (r) => ago(r.last_at) },
            ]} />
          </Section>
          {g.cities.length > 0 && (
            <Section title="Cities">
              <SimpleTable rows={g.cities as Row[]} cols={[
                { label: 'City', cell: place }, { label: 'Country', cell: (r) => country(r.country) },
                { label: 'Users', cell: (r) => num(r.users), className: right }, { label: 'Requests', cell: (r) => num(r.requests), className: right },
                { label: 'Last seen', cell: (r) => ago(r.last_at) },
              ]} />
            </Section>
          )}
        </div>
      );
    }}</AsyncView>
  );
}
