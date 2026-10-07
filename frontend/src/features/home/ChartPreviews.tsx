import { Link } from 'react-router-dom';
import { ChartThumb } from '@/features/charts/ChartThumb';
import type { Chart } from '@/lib/types';
import { Panel } from './Panel';

/** The newest charts, drawn live, so Home shows real numbers rather than icons. */
export function ChartPreviews({ charts }: { charts: Chart[] }) {
  if (!charts.length) return null;
  return (
    <Panel title="Latest charts" to="/charts">
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        {charts.slice(0, 3).map((c) => (
          <Link key={c.id} to={`/charts/${c.id}`} className="group overflow-hidden rounded-lg border transition-colors hover:border-primary">
            <div className="bg-muted/30 p-2"><ChartThumb chart={c} height={110} /></div>
            <div className="truncate border-t px-3 py-2 text-sm font-medium group-hover:text-primary" title={c.name}>{c.name}</div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
