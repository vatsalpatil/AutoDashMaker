import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { compareRows, groupRows, type Group } from '../comparison';
import { formatValue, opt, type Opts } from '../format';

/** Rows -> current / previous / growth / share, biggest first. `encoding.color` names the previous-period column. */
const compare = (spec: ChartSpec, result: QueryResult) => compareRows(result.rows, spec.encoding.x, spec.encoding.y, spec.encoding.color);
const on = (o: Opts, key: string) => o[key] !== false;   // switches default to on
const pct = (o: Opts, key: string) => (o[key] === undefined || o[key] === '' ? undefined : opt.num(o[key], 0) / 100);

export function Growth({ g, o, className }: { g: number | null; o: Opts; className?: string }) {
  if (g === null) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const good = (g >= 0) === (opt.str(o.deltaGood, 'up') === 'up');
  const d = opt.digits(o.growthDecimals, 0);
  return <span className={cn('tabular-nums font-medium', good ? 'text-success' : 'text-destructive', className)}>{g >= 0 ? '+' : ''}{(g * 100).toFixed(d)}%</span>;
}

/** Ranked list: rank, name, a bar for the current value with a marker at the previous value, the value and its growth. Every part can be turned off or recoloured. */
export function RankedBars({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const all = compare(spec, result);
  const sorted = opt.str(o.rankOrder, 'desc') === 'asc' ? [...all].reverse() : all;
  const rows = sorted.slice(0, opt.num(o.limit, 0) || undefined);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cur, r.prev ?? 0)));
  const [showRank, showBar, showGrowth] = [on(o, 'showRank'), on(o, 'showBar'), on(o, 'showGrowth') && !!spec.encoding.color];
  const barColor = opt.str(o.barColor, '') || undefined;
  const markColor = opt.str(o.markerColor, '') || undefined;
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">No data to plot.</p>;
  const cols = [showRank && '1.5rem', 'minmax(5rem,1fr)', showBar && 'minmax(4rem,30%)', 'auto', showGrowth && '3.2rem'].filter(Boolean).join(' ');
  return (
    <div className="@container flex flex-col gap-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={r.name} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }} title={`${r.name}: ${formatValue(r.cur, o)}${r.prev !== null ? ` (previous ${formatValue(r.prev, o)})` : ''}`}>
          {showRank && <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>}
          <span className="truncate font-medium">{r.name}</span>
          {showBar && (
            <span className="relative h-2.5 rounded-full bg-muted">
              <span className={cn('absolute inset-y-0 left-0 rounded-full', !barColor && 'bg-primary')} style={{ width: `${(r.cur / max) * 100}%`, background: barColor }} />
              {r.prev !== null && <span className={cn('absolute -inset-y-1 w-0.5 rounded', !markColor && 'bg-warning')} style={{ left: `${(r.prev / max) * 100}%`, background: markColor }} aria-label="previous" />}
            </span>
          )}
          <span className="text-right tabular-nums">{formatValue(r.cur, o)}</span>
          {showGrowth && <Growth g={r.growth} o={o} className="text-right text-xs" />}
        </div>
      ))}
      {spec.encoding.color && on(o, 'showKey') && (
        <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {showBar && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" style={{ background: barColor }} /> {opt.str(o.currentLabel, 'current')}</span>}
          {showBar && <span className="flex items-center gap-1"><span className="h-2.5 w-0.5 bg-warning" style={{ background: markColor }} /> {opt.str(o.previousLabel, 'previous')} (marker)</span>}
          {showGrowth && <span>% = growth vs {opt.str(o.previousLabel, 'previous')}</span>}
        </p>
      )}
    </div>
  );
}

const GROUPS: { id: Group; label: string; hint: string; color: string }[] = [
  { id: 'stars', label: 'Stars', hint: 'Big and growing faster than average: keep stocked and push', color: 'var(--success)' },
  { id: 'rising', label: 'Rising', hint: 'Small but growing fast: scale these up', color: 'var(--primary)' },
  { id: 'watch', label: 'Watch', hint: 'Big but growing slower than average: fix these first', color: 'var(--warning)' },
  { id: 'laggards', label: 'Laggards', hint: 'Small and slow: review or cut', color: 'var(--destructive)' },
];
const LAYOUT: Record<string, string> = { auto: 'grid-cols-1 @lg:grid-cols-2', '1': 'grid-cols-1', '2': 'grid-cols-2', '4': 'grid-cols-2 @3xl:grid-cols-4' };

/**
 * Performance groups (a growth-share matrix). By default "big" = share above the average share and "fast" = growth above
 * the overall growth; both lines, every group's name, advice text and colour, the layout and the item count are options.
 */
export function PerformanceGroups({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const rows = compare(spec, result);
  const { overall, bigLine, fastLine, groupOf } = groupRows(rows, { bigShare: pct(o, 'bigSharePct'), fastGrowth: pct(o, 'fastGrowthPct') });
  const max = opt.num(o.groupMaxItems, 0);
  const custom = o.bigSharePct !== undefined && o.bigSharePct !== '' || o.fastGrowthPct !== undefined && o.fastGrowthPct !== '';
  return (
    <div className="@container flex flex-col gap-2 text-sm">
      {on(o, 'showSummary') && (
        <p className="text-xs text-muted-foreground">
          Big = share ≥ {(bigLine * 100).toFixed(1)}%{custom ? '' : ' (average)'} · fast = growth ≥ <Growth g={fastLine} o={{ ...o, growthDecimals: 1 }} />{custom ? '' : ' (overall)'}
          {overall !== null && custom && <> · overall growth <Growth g={overall} o={o} /></>}
        </p>
      )}
      <div className={cn('grid gap-2', LAYOUT[opt.str(o.groupLayout, 'auto')] ?? LAYOUT.auto)}>
        {GROUPS.map((g) => {
          const items = rows.filter((r) => groupOf(r) === g.id);
          const shown = max ? items.slice(0, max) : items;
          const color = opt.str(o[`${g.id}Color`], '') || g.color;
          return (
            <div key={g.id} className="rounded-lg border border-t-2 bg-card p-2.5" style={{ borderTopColor: color }}>
              <div className="flex items-baseline justify-between"><span className="font-semibold" style={{ color: o[`${g.id}Color`] ? color : undefined }}>{opt.str(o[`${g.id}Label`], g.label)}</span><span className="text-xs text-muted-foreground">{items.length}</span></div>
              {on(o, 'showHints') && <p className="mb-1.5 text-[11px] text-muted-foreground">{opt.str(o[`${g.id}Hint`], g.hint)}</p>}
              {items.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : shown.map((r) => (
                <div key={r.name} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium" title={r.name}>{r.name}</span>
                  {on(o, 'showValues') && <span className="tabular-nums text-muted-foreground">{formatValue(r.cur, o)}</span>}
                  {on(o, 'showGrowth') && <Growth g={r.growth} o={o} className="w-12 text-right" />}
                </div>
              ))}
              {shown.length < items.length && <p className="pt-0.5 text-[11px] text-muted-foreground">+{items.length - shown.length} more</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
