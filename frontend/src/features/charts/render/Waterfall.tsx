import { Bar, BarChart, Cell, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { AXIS_FONT, axisFormatter, valueTooltip, yScaleProps } from './chartTheme';

/** Waterfall: each row moves the running total up or down; optional final total bar (Metabase's waterfall chart). */
export function Waterfall({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y } = spec.encoding;
  const up = opt.str(o.increaseColor, '#16a34a');
  const down = opt.str(o.decreaseColor, '#dc2626');
  const totalColor = opt.str(o.totalColor, '#64748b');
  let run = 0;
  const data = result.rows.map((r) => {
    const v = toNumber(r[y]);
    const start = run;
    run += v;
    return { name: String(r[x] ?? ''), range: [Math.min(start, run), Math.max(start, run)] as [number, number], delta: v, fill: v >= 0 ? up : down, label: formatValue(v, o) };
  });
  if (o.showTotal !== false) data.push({ name: 'Total', range: [Math.min(0, run), Math.max(0, run)], delta: run, fill: totalColor, label: formatValue(run, o) });
  const font = AXIS_FONT[opt.str(o.axisFontSize, 'sm')] ?? 12;
  const goal = o.refValue === undefined || o.refValue === '' ? null : opt.num(o.refValue, 0);
  const config = { range: { label: 'Running total' } };
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
        {o.grid !== 'none' && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        <XAxis dataKey="name" tick={{ fontSize: font }} tickLine={false} axisLine={false} hide={o.showXAxis === false} />
        <YAxis tick={{ fontSize: font }} tickFormatter={axisFormatter(o)} tickLine={false} axisLine={false} width={48} hide={o.showYAxis === false} {...yScaleProps(o, 'auto')} />
        {o.showTooltip !== false && <ChartTooltip content={valueTooltip(o, config)} />}
        <Bar dataKey="range" radius={opt.num(o.barRadius, 3)} isAnimationActive={o.animate !== false}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          {o.showDataLabels === true && <LabelList dataKey="label" position="top" fontSize={font - 1} className="fill-foreground" />}
        </Bar>
        {goal !== null && <ReferenceLine y={goal} stroke="var(--destructive)" strokeDasharray="4 3" label={{ value: String(o.refLabel ?? ''), position: 'insideTopRight', fontSize: font, fill: 'var(--destructive)' }} />}
      </BarChart>
    </ChartContainer>
  );
}
