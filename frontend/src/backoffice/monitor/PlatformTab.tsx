import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { num } from '../format';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { StatGrid, StatTile } from '../parts/StatTile';
import { BarList, SeriesChart, right, type Row } from './charts';

/** Weekly cohorts as a grid: % of each signup week active N weeks later. */
function Retention({ rows }: { rows: Row[] }) {
  const cohorts = [...new Set(rows.map((r) => r.cohort as string))];
  const weeks = Math.max(0, ...rows.map((r) => r.week as number)) + 1;
  const get = (c: string, w: number) => rows.find((r) => r.cohort === c && r.week === w)?.users ?? 0;
  return (
    <Section title="Retention by signup week" description="% of each week's new users still active N weeks later">
      <SimpleTable rows={cohorts} empty="Not enough history yet." cols={[
        { label: 'Cohort', cell: (c) => c },
        { label: 'Users', cell: (c) => num(get(c, 0)), className: right },
        ...Array.from({ length: Math.max(0, weeks - 1) }, (_, i) => ({
          label: `W${i + 1}`, className: 'text-center',
          cell: (c: string) => {
            const base = get(c, 0), pct = base ? Math.round((100 * get(c, i + 1)) / base) : 0;
            return <span className="inline-block w-10 rounded bg-primary/15 py-0.5 tabular-nums" style={{ opacity: 0.35 + pct / 154 }}>{pct}%</span>;
          },
        })),
      ]} />
    </Section>
  );
}

/** Growth & positioning: engagement, growth, retention, adoption, content. */
export function PlatformTab({ days }: { days: string }) {
  const state = useApi<Row>(`/admin/monitor/platform?days=${Math.max(7, Number(days))}`);
  return (
    <AsyncView state={state}>{(p) => {
      const e = p.engagement, daily = new Map<string, Row>();
      for (const r of p.content_daily as Row[]) daily.set(r.day, { ...(daily.get(r.day) ?? { day: r.day }), [r.kind]: r.n });
      return (
        <div className="flex flex-col gap-3">
          <StatGrid>
            <StatTile label="Users ever" value={num(e.total_users)} />
            <StatTile label="DAU" value={num(e.dau)} />
            <StatTile label="WAU" value={num(e.wau)} />
            <StatTile label="MAU" value={num(e.mau)} />
            <StatTile label="Stickiness" value={e.mau ? `${Math.round((100 * e.dau) / e.mau)}%` : '—'} hint="DAU ÷ MAU" />
            <StatTile label="Monthly reach" value={e.total_users ? `${Math.round((100 * e.mau) / e.total_users)}%` : '—'} hint="MAU ÷ all users" />
          </StatGrid>
          <div className="grid gap-3 lg:grid-cols-2">
            <SeriesChart title="User growth" description="total users over time" data={p.growth} x="day" series={[{ key: 'total', label: 'Total users' }]} />
            <SeriesChart title="Active vs new users per day" data={p.growth} x="day" bars series={[{ key: 'active', label: 'Active' }, { key: 'new_users', label: 'New' }]} />
          </div>
          <Retention rows={p.retention} />
          <div className="grid gap-3 lg:grid-cols-2">
            <BarList title="Feature adoption" description="share of active users who touched each area" rows={p.adoption} value="users" extra={(r) => `· ${r.pct}%`} />
            <BarList title="AI features" description="calls per AI feature" rows={p.ai_features} extra={(r) => `· ${num(r.tokens)} tok`} />
          </div>
          <Section title="Content on the platform" description={`totals, created in the last ${p.days} days, and how many workspaces have any`}>
            <SimpleTable rows={Object.entries(p.content as Record<string, Row>)} cols={[
              { label: 'Kind', cell: ([k]) => k },
              { label: 'Total', cell: ([, v]) => num(v.total), className: right },
              { label: `New (${p.days}d)`, cell: ([, v]) => num(v.recent), className: right },
              { label: 'Workspaces', cell: ([, v]) => num(v.workspaces), className: right },
            ]} />
          </Section>
          <div className="grid gap-3 lg:grid-cols-2">
            <SeriesChart title="Content created per day" bars data={[...daily.values()].sort((a, b) => a.day.localeCompare(b.day))} x="day"
              series={[{ key: 'datasets', label: 'Datasets' }, { key: 'dashboards', label: 'Dashboards' }, { key: 'charts', label: 'Charts' }]} />
            <BarList title="Most datasets" rows={p.leaders} label="owner" />
          </div>
        </div>
      );
    }}</AsyncView>
  );
}
