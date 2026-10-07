import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { AXIS_FONT, axisFormatter, seriesColors, valueTooltip } from './chartTheme';

/** Histogram: how often a number falls in each bucket. Bucket count is automatic (Sturges) unless set. */
export function Histogram({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const col = spec.encoding.y || spec.encoding.x;
  const vals = result.rows.map((r) => r[col]).filter((v) => v !== null && v !== '' && Number.isFinite(Number(v))).map(toNumber);
  if (vals.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Pick a number column to bucket.</p>;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const bins = Math.max(2, Math.min(60, opt.num(o.binCount, 0) || Math.ceil(Math.log2(vals.length) + 1)));
  const width = (hi - lo) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of vals) counts[Math.min(bins - 1, Math.floor((v - lo) / width))] += 1;
  const short = { numberFormat: 'compact' };
  const data = counts.map((count, i) => ({ name: `${formatValue(lo + i * width, short)}–${formatValue(lo + (i + 1) * width, short)}`, count }));
  const font = AXIS_FONT[opt.str(o.axisFontSize, 'sm')] ?? 12;
  const config = { count: { label: 'Rows', color: seriesColors(o, 1)[0] } };
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} barCategoryGap={1} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
        {o.grid !== 'none' && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        <XAxis dataKey="name" tick={{ fontSize: font }} tickLine={false} axisLine={false} minTickGap={12} hide={o.showXAxis === false} />
        <YAxis tick={{ fontSize: font }} tickFormatter={axisFormatter(o)} tickLine={false} axisLine={false} width={40} hide={o.showYAxis === false} />
        {o.showTooltip !== false && <ChartTooltip content={valueTooltip(o, config)} />}
        <Bar dataKey="count" fill="var(--color-count)" radius={opt.num(o.barRadius, 2)} isAnimationActive={o.animate !== false && data.length < 60} />
      </BarChart>
    </ChartContainer>
  );
}
