import { Cell, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { paletteColors } from '../palettes';
import { valueTooltip } from './chartTheme';

/** Sunburst: inner ring = first category, outer ring = its sub-categories (Metabase's sunburst chart). */
export function Sunburst({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y, color } = spec.encoding;
  const palette = paletteColors(o.palette);
  const parents = new Map<string, number>();
  const kids: { name: string; parent: number; value: number }[] = [];
  for (const r of result.rows) {
    const p = String(r[x] ?? '');
    const v = toNumber(r[y]);
    parents.set(p, (parents.get(p) ?? 0) + v);
    if (color) kids.push({ name: String(r[color] ?? ''), parent: [...parents.keys()].indexOf(p), value: v });
  }
  const keys = [...parents.keys()];
  const inner = keys.map((name, i) => ({ name, value: parents.get(name) ?? 0, fill: palette[i % palette.length] }));
  const outer = kids.map((k) => ({ name: `${keys[k.parent]} › ${k.name}`, value: k.value, fill: palette[k.parent % palette.length] })).sort((a, b) => keys.findIndex((p) => a.name.startsWith(`${p} ›`)) - keys.findIndex((p) => b.name.startsWith(`${p} ›`)));
  const config = Object.fromEntries([...inner, ...outer].map((d) => [d.name, { label: d.name, color: d.fill }]));
  const total = inner.reduce((a, d) => a + d.value, 0) || 1;
  const labels = o.showDataLabels !== false;
  const text = (d: { name?: string; value?: number }) => (labels ? `${(d.name ?? '').split(' › ').pop()}${o.pieLabels === 'percent' ? ` ${(((d.value ?? 0) / total) * 100).toFixed(0)}%` : ''}` : '');
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <PieChart>
        {o.showTooltip !== false && <ChartTooltip content={valueTooltip(o, config, { nameKey: 'name', hideLabel: true })} />}
        <Pie data={inner} dataKey="value" nameKey="name" outerRadius="45%" innerRadius="12%" stroke="var(--card)" isAnimationActive={o.animate !== false} label={labels ? (p) => text(p as { name?: string; value?: number }) : false} labelLine={false}>
          {inner.map((d) => <Cell key={d.name} fill={d.fill} />)}
        </Pie>
        {outer.length > 0 && (
          <Pie data={outer} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" stroke="var(--card)" isAnimationActive={o.animate !== false} label={labels && outer.length <= 30 ? (p) => text(p as { name?: string; value?: number }) : false}>
            {outer.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.65} />)}
          </Pie>
        )}
      </PieChart>
    </ChartContainer>
  );
}
