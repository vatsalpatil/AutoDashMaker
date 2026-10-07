import { memo, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { DataTable } from '@/components/common/DataTable';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { prepare } from '../chartData';
import { opt, toNumber } from '../format';
import { isCustom, kindOf } from '../chartKinds';
import { resolveOptions } from '../optionSchema';
import { BoxPlot } from './BoxPlot';
import { CartesianChart } from './CartesianChart';
import { Gauge } from './Gauge';
import { Histogram } from './Histogram';
import { KpiCard } from './KpiCard';
import { PartToWhole } from './PartToWhole';
import { PivotTable } from './PivotTable';
import { ProgressBar } from './ProgressBar';
import { RadarView } from './RadarView';
import { SankeyView } from './SankeyView';
import { ScatterView } from './ScatterView';
import { Sunburst } from './Sunburst';
import { Waterfall } from './Waterfall';

const BACKGROUND: Record<string, string> = {
  none: '',
  card: 'rounded-xl border bg-card',
  muted: 'rounded-xl bg-muted/50',
  gradient: 'rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5',
};

interface Props {
  spec: ChartSpec;
  result: QueryResult;
  height?: number;
  /** Options layered over the chart's own (a dashboard widget's overrides). */
  options?: Record<string, unknown>;
  /** Clicking a bar / slice / point reports the X field and the clicked value (dashboards use it to cross-filter). */
  onPick?: (field: string, value: string) => void;
}

/** Renders any chart type from its spec + query result. The single entry point for charts, widgets and the studio. */
function ChartViewBase({ spec, result, height = 320, options, onPick }: Props) {
  const [box, width] = useContainerWidth<HTMLDivElement>();
  const compact = width > 0 && width < 420;                 // narrow cards (phones, small dashboard tiles): lighter axes, no data labels
  const [range, setRange] = useState(0);                    // 0 = all points; the interactive range selector
  const pick = useMemo(() => (onPick ? (value: string) => onPick(spec.encoding.x, value) : undefined), [onPick, spec.encoding.x]);
  const o = useMemo(() => resolveOptions({ ...spec.options, ...options }), [spec.options, options]);
  const family = kindOf(spec.type).family;
  const custom = isCustom(spec.type);
  const full = useMemo(
    () => (!custom && ((family === 'cartesian' && spec.type !== 'scatter') || family === 'part' || family === 'radar') ? prepare(result, spec, o) : null),
    [result, spec, o, family, custom],
  );
  const cartesian = family === 'cartesian' && spec.type !== 'scatter' && !custom;
  const prep = useMemo(() => (full && cartesian && range > 0 && o.rangeSelect === true ? { ...full, rows: full.rows.slice(-range) } : full), [full, cartesian, range, o.rangeSelect]);
  // change of the first series between the last two shown points (ReUI's trend badge)
  const trend = useMemo(() => {
    const rows = prep?.rows ?? [];
    if (!cartesian || o.trendBadge !== true || rows.length < 2) return null;
    const last = toNumber(rows[rows.length - 1].s0);
    const before = toNumber(rows[rows.length - 2].s0);
    return before === 0 ? null : ((last - before) / Math.abs(before)) * 100;
  }, [prep, cartesian, o.trendBadge]);
  const controls = cartesian && (o.rangeSelect === true || trend !== null);
  const heading = (Boolean(o.chartTitle || o.chartSubtitle) || controls) && spec.type !== 'kpi';
  const headingH = heading ? (o.chartSubtitle ? 52 : 32) : 0;
  const h = Math.max(height - headingH, 80);

  let body: React.ReactNode;
  if (spec.type === 'table') {
    body = (
      <DataTable columns={result.columns} rows={result.rows} fontSize={o.tableFontSize as 'xs' | 'sm' | 'md'}
        density={o.tableDensity as 'compact' | 'comfortable'} striped={o.tableStriped === true} />
    );
  } else if (spec.type === 'pivot') body = <PivotTable spec={spec} result={result} o={o} />;
  else if (spec.type === 'kpi') body = <KpiCard spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'waterfall') body = <Waterfall spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'histogram') body = <Histogram spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'boxplot') body = <BoxPlot spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'gauge') body = <Gauge spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'progress') body = <ProgressBar spec={spec} result={result} o={o} />;
  else if (spec.type === 'sankey') body = <SankeyView spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'sunburst') body = <Sunburst spec={spec} result={result} o={o} height={h} />;
  else if (spec.type === 'scatter') body = <ScatterView spec={spec} result={result} o={o} height={h} />;
  else if (!prep || prep.rows.length === 0) body = <p className="p-6 text-center text-sm text-muted-foreground">No data to plot.</p>;
  else if (family === 'part') body = <PartToWhole spec={spec} prep={prep} o={o} height={h} onPick={pick} />;
  else if (family === 'radar') body = <RadarView prep={prep} o={o} height={h} />;
  else body = <CartesianChart spec={spec} prep={prep} o={o} height={h} compact={compact} onPick={pick} />;

  return (
    <div ref={box} className={cn('flex flex-col gap-2', BACKGROUND[String(o.background)] ?? '', o.background !== 'none' && 'p-3')}>
      {heading && (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {o.chartTitle ? <h3 className="truncate text-sm font-semibold leading-tight">{String(o.chartTitle)}</h3> : null}
            {o.chartSubtitle ? <p className="truncate text-xs text-muted-foreground">{String(o.chartSubtitle)}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {trend !== null && (
              <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                (trend >= 0) === (opt.str(o.deltaGood, 'up') === 'up') ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')} title="Change of the last point vs the one before">
                {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
            {o.rangeSelect === true && cartesian && (
              <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Range" onClick={(e) => e.stopPropagation()}
                className="h-7 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <option value={0}>All</option><option value={7}>Last 7</option><option value={30}>Last 30</option><option value={90}>Last 90</option>
              </select>
            )}
          </div>
        </div>
      )}
      {body}
    </div>
  );
}

/** Memoised: dashboards and the studio re-render often; a chart only redraws when its spec, data or options change. */
export const ChartView = memo(ChartViewBase);
