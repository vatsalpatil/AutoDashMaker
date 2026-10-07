import { CartesianGrid, Line, ComposedChart, Scatter, XAxis, YAxis, ZAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { AXIS_FONT, axisFormatter, chartConfig, legendAt, seriesColors } from './chartTheme';

/** Scatter / bubble chart straight from query rows; `color` splits points into groups, `size` makes bubbles. */
export function ScatterView({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y, color, size } = spec.encoding;
  const groups = new Map<string, { x: number; y: number; z: number }[]>();
  for (const r of result.rows) {
    const g = color ? String(r[color] ?? '') : y;
    const pts = groups.get(g) ?? [];
    pts.push({ x: toNumber(r[x]), y: toNumber(r[y]), z: size ? toNumber(r[size]) : 1 });
    groups.set(g, pts);
  }
  const series = [...groups.keys()].slice(0, 12).map((label, i) => ({ key: `s${i}`, label }));
  const colors = seriesColors(o, series.length);
  const config = chartConfig(series, colors);
  const font = AXIS_FONT[opt.str(o.axisFontSize, 'sm')] ?? 12;
  const grid = opt.str(o.grid, 'both');
  const dot = opt.num(o.dotSize, 8);
  const fmtAxis = axisFormatter(o);

  const all = result.rows.map((r) => ({ x: toNumber(r[x]), y: toNumber(r[y]) }));
  const line = o.trendline === true && all.length > 1 ? fit(all) : null;

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
        {grid !== 'none' && <CartesianGrid vertical={grid !== 'horizontal'} horizontal={grid !== 'vertical'} strokeDasharray="3 3" />}
        <XAxis type="number" dataKey="x" name={x} tick={{ fontSize: font }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
        <YAxis type="number" dataKey="y" name={y} tick={{ fontSize: font }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
        <ZAxis type="number" dataKey="z" range={size ? [dot * 6, dot * 40] : [dot * 8, dot * 8]} />
        {o.showTooltip !== false && (
          <ChartTooltip cursor={{ strokeDasharray: '3 3' }}
            content={<ChartTooltipContent hideLabel formatter={(v, n) => <><span className="text-muted-foreground">{String(n)}</span><span className="ml-auto pl-3 font-mono">{formatValue(v, o)}</span></>} />} />
        )}
        {o.showLegend !== false && series.length > 1 && <ChartLegend verticalAlign={legendAt(o)} content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Scatter key={s.key} name={s.label} data={groups.get(s.label)} fill={`var(--color-${s.key})`} fillOpacity={opt.num(o.dotOpacity, 0.8)} isAnimationActive={o.animate !== false} />
        ))}
        {line && <Line data={line} dataKey="y" dot={false} stroke="var(--muted-foreground)" strokeDasharray="5 4" legendType="none" isAnimationActive={false} />}
      </ComposedChart>
    </ChartContainer>
  );
}

/** Two end points of the least-squares line, for the trend overlay. */
function fit(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / (pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) || 1);
  const xs = pts.map((p) => p.x);
  return [Math.min(...xs), Math.max(...xs)].map((px) => ({ x: px, y: my + slope * (px - mx) }));
}
