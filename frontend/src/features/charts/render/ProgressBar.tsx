import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';

/** Progress toward a goal: a fixed number or another column of the result (Metabase's progress bar). */
export function ProgressBar({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const { x, y } = spec.encoding;
  const last = result.rows[result.rows.length - 1];
  const value = toNumber(last?.[y] ?? last?.[x]);
  const goalCol = opt.str(o.goalColumn, '');
  const goal = goalCol && last ? toNumber(last[goalCol]) : opt.num(o.goalValue, 100);
  const ratio = goal ? value / goal : 0;
  const pct = Math.min(Math.max(ratio, 0), 1) * 100;
  const reached = ratio >= 1;
  const color = reached ? opt.str(o.goalReachedColor, '#16a34a') : opt.str(o.progressColor, 'var(--primary)');
  const text = o.progressPercent === true ? `${(ratio * 100).toFixed(opt.num(o.decimals, 0))}%` : formatValue(value, o);
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums">{text}</span>
        <span className="text-sm text-muted-foreground">Goal {formatValue(goal, o)}</span>
      </div>
      <div className="h-5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-muted-foreground">{reached ? 'Goal reached' : `${(ratio * 100).toFixed(0)}% of the way`}</span>
    </div>
  );
}
