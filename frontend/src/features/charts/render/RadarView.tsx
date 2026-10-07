import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart';
import type { Prepared } from '../chartData';
import { opt, type Opts } from '../format';
import { chartConfig, legendAt, seriesColors, valueTooltip } from './chartTheme';
import { FillDefs, fillRef, glowStyle, useUid, type FillStyle } from './fills';

export function RadarView({ prep, o, height }: { prep: Prepared; o: Opts; height: number }) {
  const colors = seriesColors(o, prep.series.length);
  const config = chartConfig(prep.series, colors);
  const uid = useUid();
  const fill = opt.str(o.fillStyle, 'solid') as FillStyle;
  const grid = opt.str(o.radarGrid, 'polygon');
  const glow = o.glow === true;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <RadarChart data={prep.rows} outerRadius="75%">
        {o.showTooltip !== false && <ChartTooltip content={valueTooltip(o, config)} />}
        {fill !== 'solid' && <FillDefs uid={uid} items={prep.series.map((s) => ({ key: s.key, color: `var(--color-${s.key})` }))} opacity={opt.num(o.fillOpacity, 0.3)} vertical />}
        {grid !== 'none' && <PolarGrid gridType={grid === 'circle' ? 'circle' : 'polygon'} />}
        <PolarAngleAxis dataKey="x" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis tick={{ fontSize: 10 }} axisLine={false} />
        {prep.series.map((s) => (
          <Radar key={s.key} dataKey={s.key} stroke={`var(--color-${s.key})`} style={glowStyle(`var(--color-${s.key})`, glow)}
            fill={fill === 'solid' ? `var(--color-${s.key})` : fillRef(fill, uid, s.key, `var(--color-${s.key})`, 'area')}
            fillOpacity={fill === 'solid' ? opt.num(o.fillOpacity, 0.3) : 1} strokeWidth={opt.num(o.lineWidth, 2)} dot={o.dots === true}
            isAnimationActive={o.animate !== false} />
        ))}
        {o.showLegend !== false && prep.series.length > 1 && <ChartLegend verticalAlign={legendAt(o)} content={<ChartLegendContent />} />}
      </RadarChart>
    </ChartContainer>
  );
}
