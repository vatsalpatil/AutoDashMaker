import { Cell, Funnel, FunnelChart, LabelList, Pie, PieChart, Treemap } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart';
import type { ChartSpec } from '@/lib/types';
import type { Prepared } from '../chartData';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { paletteColors } from '../palettes';
import { chartConfig, legendAt, valueTooltip } from './chartTheme';
import { FillDefs, fillRef, useUid, type FillStyle } from './fills';

interface Props { spec: ChartSpec; prep: Prepared; o: Opts; height: number; onPick?: (value: string) => void }

/** Pie / donut, funnel and treemap: one measure split over categories. */
export function PartToWhole({ spec, prep, o, height, onPick }: Props) {
  const uid = useUid();
  const base = paletteColors(o.palette);
  const total = prep.rows.reduce((a, r) => a + toNumber(r.s0), 0) || 1;
  const minPct = spec.type === 'pie' ? opt.num(o.minSlicePercent, 0) : 0;
  const slices = prep.rows.map((r) => ({ name: String(r.x), value: toNumber(r.s0) }));
  const small = slices.filter((s) => (s.value / total) * 100 < minPct);
  const kept = minPct > 0 && small.length > 1 ? [...slices.filter((s) => !small.includes(s)), { name: 'Other', value: small.reduce((a, s) => a + s.value, 0) }] : slices;   // tiny slices fold into "Other"
  const data = kept.map((r, i) => ({ ...r, fill: base[i % base.length], key: `c${i}` }));
  const config = chartConfig(data.map((d) => ({ key: d.name, label: d.name })), data.map((d) => d.fill));
  const animate = o.animate !== false && data.length <= 60;
  const fillStyle = opt.str(o.fillStyle, 'solid') as FillStyle;
  const paint = (d: { key: string; fill: string }) => fillRef(fillStyle, uid, d.key, d.fill, 'slice');
  const labelMode = opt.str(o.pieLabels, 'name');
  const text = (d: { name: string; value: number }) =>
    labelMode === 'percent' ? `${((d.value / total) * 100).toFixed(1)}%` : labelMode === 'value' ? formatValue(d.value, o) : d.name;
  const legend = o.showLegend !== false && <ChartLegend verticalAlign={legendAt(o)} content={<ChartLegendContent nameKey="name" />} />;
  const tip = o.showTooltip !== false && <ChartTooltip content={valueTooltip(o, config, { nameKey: 'name', hideLabel: true })} />;

  if (spec.type === 'funnel') {
    const rows = [...data].sort((a, b) => (o.funnelPyramid ? a.value - b.value : b.value - a.value));
    return (
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <FunnelChart>
          {tip}
          <Funnel dataKey="value" nameKey="name" data={rows} isAnimationActive={animate} onClick={onPick ? (d: { name?: string }) => d?.name && onPick(d.name) : undefined}>
            {rows.map((d) => <Cell key={d.key} fill={d.fill} />)}
            <LabelList position="right" dataKey="name" className="fill-foreground" fontSize={12} />
            {o.showDataLabels === true && <LabelList position="center" dataKey="value" formatter={(v: unknown) => formatValue(v, o)} className="fill-white" fontSize={12} />}
          </Funnel>
        </FunnelChart>
      </ChartContainer>
    );
  }

  if (spec.type === 'treemap') {
    return (
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <Treemap data={data} dataKey="value" nameKey="name" stroke="var(--card)" isAnimationActive={animate} onClick={onPick ? (d: { name?: string }) => d?.name && onPick(d.name) : undefined}
          content={<TreemapTile o={o} showValue={o.showDataLabels === true} />}>
          {tip}
        </Treemap>
      </ChartContainer>
    );
  }

  const donut = o.donut === true;
  const inner = donut ? `${opt.num(o.innerRadius, 55)}%` : 0;
  const start = opt.num(o.startAngle, 0);
  const semi = o.semi === true;
  const center = donut ? opt.str(o.centerLabel, 'none') : 'none';
  return (
    <div className="relative">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <PieChart>
          {fillStyle !== 'solid' && <FillDefs uid={uid} items={data.map((d) => ({ key: d.key, color: d.fill }))} vertical={false} />}
          {tip}
          <Pie data={data} dataKey="value" nameKey="name" onClick={onPick ? (d: { name?: string }) => d?.name && onPick(d.name) : undefined} outerRadius={semi ? '120%' : '80%'} innerRadius={semi && inner ? `${opt.num(o.innerRadius, 55) * 1.5}%` : inner} cy={semi ? '78%' : '50%'}
            paddingAngle={opt.num(o.padAngle, 0)} cornerRadius={opt.num(o.cornerRadius, 0)}
            startAngle={semi ? 180 : 90 - start} endAngle={semi ? 0 : -270 - start} isAnimationActive={animate}
            label={labelMode === 'none' || semi ? false : (p: { name?: string; value?: number }) => text({ name: p.name ?? '', value: p.value ?? 0 })}>
            {data.map((d) => <Cell key={d.key} fill={paint(d)} stroke={fillStyle === 'solid' ? undefined : d.fill} />)}
          </Pie>
          {legend}
        </PieChart>
      </ChartContainer>
      {center !== 'none' && (
        <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center text-center" style={{ top: semi ? '58%' : 0, bottom: semi ? undefined : (o.showLegend !== false ? 28 : 0) }}>
          <span className="text-2xl font-semibold tabular-nums leading-tight">{center === 'custom' ? opt.str(o.centerText, '') : formatValue(total === 1 && data.length === 0 ? 0 : total, o)}</span>
          {center === 'total' && <span className="text-xs text-muted-foreground">Total</span>}
        </div>
      )}
    </div>
  );
}

function TreemapTile(p: { x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; fill?: string; o: Opts; showValue: boolean }) {
  const { x = 0, y = 0, width = 0, height = 0 } = p;
  if (width < 4 || height < 4) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={p.fill} stroke="var(--card)" strokeWidth={2} />
      {width > 50 && height > 24 && (
        <text x={x + 8} y={y + 18} fontSize={12} fontWeight={600} fill="white">
          {String(p.name ?? '')}{p.showValue ? ` · ${formatValue(p.value, p.o)}` : ''}
        </text>
      )}
    </g>
  );
}
