import { Link } from 'react-router-dom';
import { BarChart3, Bell, Database, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { fmt } from '@/lib/utils';

interface Counts { datasets: number; dashboards: number; charts: number; alerts: number }

/** At-a-glance totals; each tile is also the shortcut to that list. */
export function StatTiles({ counts }: { counts: Counts }) {
  const tiles: { to: string; label: string; value: number; icon: LucideIcon }[] = [
    { to: '/sources', label: 'Datasets', value: counts.datasets, icon: Database },
    { to: '/dashboards', label: 'Dashboards', value: counts.dashboards, icon: LayoutDashboard },
    { to: '/charts', label: 'Charts', value: counts.charts, icon: BarChart3 },
    { to: '/alerts', label: 'Active alerts', value: counts.alerts, icon: Bell },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ to, label, value, icon: Icon }) => (
        <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-primary">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
          <span className="min-w-0">
            <span className="block text-xl font-semibold leading-none tabular-nums">{fmt(value)}</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground group-hover:text-primary">{label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
