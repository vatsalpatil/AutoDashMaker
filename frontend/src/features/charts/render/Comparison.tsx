import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { compareRows, groupRows } from '../comparison';
import { formatValue, opt, type Opts } from '../format';

/** Rows -> current / previous / growth / share, biggest first. `encoding.color` names the previous-period column. */
const compare = (spec: ChartSpec, result: QueryResult) => compareRows(result.rows, spec.encoding.x, spec.encoding.y, spec.encoding.color);

export function Growth({ g, o, className }: { g: number | null; o: Opts; className?: string }) {
  if (g === null) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const good = (g >= 0) === (opt.str(o.deltaGood, 'up') === 'up');
  return <span className={cn('tabular-nums font-medium', good ? 'text-success' : 'text-destructive', className)}>{g >= 0 ? '+' : ''}{Math.round(g * 100)}%</span>;
}

/** Ranked list: rank, name, a bar for the current value with a marker at the previous value, the value and its growth. */
export function RankedBars({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const rows = compare(spec, result).slice(0, opt.num(o.limit, 0) || undefined);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cur, r.prev ?? 0)));
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">No data to plot.</p>;
  return (
    <div className="@container flex flex-col gap-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={r.name} className="grid grid-cols-[1.25rem_minmax(5rem,1fr)_auto_3rem] items-center gap-2 @sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(4rem,30%)_auto_3.2rem]" title={`${r.name}: ${formatValue(r.cur, o)}${r.prev !== null ? ` (previous ${formatValue(r.prev, o)})` : ''}`}>
          <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="truncate font-medium">{r.name}</span>
          <span className="relative hidden h-2.5 rounded-full bg-muted @sm:block">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(r.cur / max) * 100}%` }} />
            {r.prev !== null && <span className="absolute -inset-y-1 w-0.5 rounded bg-warning" style={{ left: `${(r.prev / max) * 100}%` }} aria-label="previous" />}
          </span>
          <span className="text-right tabular-nums">{formatValue(r.cur, o)}</span>
          <Growth g={r.growth} o={o} className="text-right text-xs" />
        </div>
      ))}
      {spec.encoding.color && <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> current</span><span className="flex items-center gap-1"><span className="h-2.5 w-0.5 bg-warning" /> previous (marker)</span><span>% = growth vs previous</span></p>}
    </div>
  );
}

const GROUPS = [
  { id: 'stars', label: 'Stars', hint: 'Big and growing faster than average: keep stocked and push', tone: 'border-t-success' },
  { id: 'rising', label: 'Rising', hint: 'Small but growing fast: scale these up', tone: 'border-t-primary' },
  { id: 'watch', label: 'Watch', hint: 'Big but growing slower than average: fix these first', tone: 'border-t-warning' },
  { id: 'laggards', label: 'Laggards', hint: 'Small and slow: review or cut', tone: 'border-t-destructive' },
] as const;

/**
 * Performance groups (a growth-share matrix): "big" = share above the average share, "fast" = growth above the overall growth.
 * Answers "which items to push, scale, fix or cut" at a glance.
 */
export function PerformanceGroups({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const rows = compare(spec, result);
  const { overall, avgShare, groupOf } = groupRows(rows);
  return (
    <div className="@container flex flex-col gap-2 text-sm">
      <p className="text-xs text-muted-foreground">Average share {(avgShare * 100).toFixed(1)}% · overall growth <Growth g={overall} o={o} /> vs previous</p>
      <div className="grid gap-2 @lg:grid-cols-2">   {/* two columns only when the WIDGET is wide enough, not the screen */}
        {GROUPS.map((g) => {
          const items = rows.filter((r) => groupOf(r) === g.id);
          return (
            <div key={g.id} className={cn('rounded-lg border border-t-2 bg-card p-2.5', g.tone)}>
              <div className="flex items-baseline justify-between"><span className="font-semibold">{g.label}</span><span className="text-xs text-muted-foreground">{items.length}</span></div>
              <p className="mb-1.5 text-[11px] text-muted-foreground">{g.hint}</p>
              {items.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : items.map((r) => (
                <div key={r.name} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium" title={r.name}>{r.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatValue(r.cur, o)}</span>
                  <Growth g={r.growth} o={o} className="w-10 text-right" />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
