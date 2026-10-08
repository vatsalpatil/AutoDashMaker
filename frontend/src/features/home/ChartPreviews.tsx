import { Link } from 'react-router-dom';
import { ChartThumb } from '@/features/charts/ChartThumb';
import { cn } from '@/lib/utils';
import type { Chart } from '@/lib/types';
import { Panel } from './Panel';

/** The newest charts, drawn live, so Home shows real numbers (6 / 9 / 10 by screen width, so every row is full) rather than icons. */
export function ChartPreviews({ charts }: { charts: Chart[] }) {
  if (!charts.length) return null;
  return (
    <Panel title="Latest charts" to="/charts">
      <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-5">
        {charts.slice(0, 10).map((c, i) => (
          <Link key={c.id} to={`/charts/${c.id}`} className={cn('group overflow-hidden rounded-lg border transition-colors hover:border-primary', i >= 9 ? 'hidden xl:block' : i >= 6 && 'hidden md:block')}>
            <div className="bg-muted/30 p-2"><ChartThumb chart={c} height={130} /></div>
            <div className="truncate border-t px-3 py-2 text-sm font-medium group-hover:text-primary" title={c.name}>{c.name}</div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
