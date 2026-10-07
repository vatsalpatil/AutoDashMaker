import { Link } from 'react-router-dom';
import { Database, LayoutDashboard } from 'lucide-react';
import { ChartThumb } from '@/features/charts/ChartThumb';
import { useApi } from '@/hooks/useApi';
import { fmt, timeAgo } from '@/lib/utils';
import type { Chart, Dashboard, Dataset } from '@/lib/types';
import { HomeSection } from './HomeSection';

const CARD = 'group rounded-xl border bg-card shadow-xs transition-colors hover:border-primary';

export function RecentDashboards() {
  const items = (useApi<Dashboard[]>('/dashboards').data ?? []).slice(0, 4);
  if (!items.length) return null;
  return (
    <HomeSection title="Dashboards" to="/dashboards">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((d) => (
          <Link key={d.id} to={`/dashboards/${d.id}`} className={`${CARD} flex flex-col gap-2 p-4`}>
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><LayoutDashboard className="size-4" /></span>
            <span className="truncate text-sm font-semibold group-hover:text-primary" title={d.name}>{d.name}</span>
            <span className="truncate text-xs text-muted-foreground">{d.description || `Created ${timeAgo(d.created_at)}`}</span>
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}

export function RecentCharts() {
  const items = (useApi<Chart[]>('/charts').data ?? []).slice(0, 4);
  if (!items.length) return null;
  return (
    <HomeSection title="Charts" to="/charts">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((c) => (
          <Link key={c.id} to={`/charts/${c.id}`} className={`${CARD} overflow-hidden`}>
            <div className="border-b bg-muted/30 p-2"><ChartThumb chart={c} height={110} /></div>
            <div className="p-3">
              <div className="truncate text-sm font-semibold group-hover:text-primary" title={c.name}>{c.name}</div>
              <div className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</div>
            </div>
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}

export function YourData({ datasets }: { datasets: Dataset[] }) {
  if (!datasets.length) return null;
  return (
    <HomeSection title="Your data" to="/sources">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {datasets.slice(0, 6).map((d) => (
          <Link key={d.id} to={`/datasets/${d.id}`} className={`${CARD} flex items-center gap-3 p-3`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Database className="size-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold group-hover:text-primary" title={d.name}>{d.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{fmt(d.row_count)} rows · {fmt(d.column_count)} columns</span>
            </span>
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}
