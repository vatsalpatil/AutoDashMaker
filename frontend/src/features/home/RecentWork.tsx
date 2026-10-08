import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LayoutDashboard } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { Panel } from './Panel';
import { recentWork, type RecentItem } from './recent';

type Filter = 'all' | 'dashboard' | 'chart';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'dashboard', label: 'Dashboards' }, { id: 'chart', label: 'Charts' }];

/** "Pick up where you left off": dashboards and charts in one list, newest first. */
export function RecentWork({ dashboards, charts }: { dashboards: { id: string; name: string; created_at?: string; description?: string }[]; charts: { id: string; name: string; created_at?: string }[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const items = recentWork(filter === 'chart' ? [] : dashboards, filter === 'dashboard' ? [] : charts, 8);
  return (
    <Panel title="Recent work" to="/dashboards" linkLabel="All dashboards"
      actions={
        <div className="flex gap-1 sm:ml-auto">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn('rounded-md px-2 py-0.5 text-xs transition-colors', filter === f.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}>{f.label}</button>
          ))}
        </div>
      }>
      {items.length === 0
        ? <p className="px-4 py-6 text-sm text-muted-foreground">Nothing here yet. <Link to="/dashboards" className="text-primary hover:underline">Generate a dashboard</Link> from one of your datasets.</p>
        : <ul className="flex flex-1 flex-col divide-y">{items.map((i) => <Row key={`${i.kind}-${i.id}`} item={i} />)}</ul>}
    </Panel>
  );
}

function Row({ item }: { item: RecentItem }) {
  const Icon = item.kind === 'dashboard' ? LayoutDashboard : BarChart3;
  return (
    <li className="flex-1">
      <Link to={item.to} className="group flex h-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium group-hover:text-primary" title={item.name}>{item.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.kind === 'dashboard' ? (item.note || 'Dashboard') : 'Chart'}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.when)}</span>
      </Link>
    </li>
  );
}
