import { memo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis,
} from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart';
import type { ChartSpec } from '@/lib/types';
import { BIG_DATA, thinRows, type Prepared } from '../chartData';
import { formatValue, opt, type Opts } from '../format';
import { AXIS_FONT, axisFormatter, chartConfig, legendAt, seriesColors, valueTooltip, yScaleProps } from './chartTheme';
import { forecastKey, withForecast } from '../forecast';
import { Bar3D, depthOf, type BarStyle } from './Bar3D';
import { FillDefs, fillRef, glowStyle, useUid, type FillStyle } from './fills';

interface Props { spec: ChartSpec; prep: Prepared; o: Opts; height: number; compact?: boolean; onPick?: (value: string) => void }
type Curve = 'monotone' | 'linear' | 'step' | 'natural' | 'basis' | 'bump' | 'stepBefore' | 'stepAfter';

/** Which fill a bar / area gets: the new "Fill style" option, else the old gradient switch (areas) or solid (bars). */
const fillStyleOf = (o: Opts, type: string): FillStyle =>
  (opt.str(o.fillStyle, type === 'area' && o.gradient !== false ? 'gradient' : 'solid') as FillStyle);

/** Bar, line, area and combo charts: multi-series, stacking, horizontal bars, dual axis, reference line, trend, pattern fills, glow. */
function CartesianChartBase({ spec, prep, o, height, compact = false, onPick }: Props) {
  const uid = useUid();
  const type = spec.type;
  const horizontal = type === 'bar' && o.horizontal === true;
  const thinned = prep.rows.length > BIG_DATA * 4 && type !== 'bar' ? thinRows(prep.rows) : prep.rows;   // long series: min/max decimation
  // forecast: dashed twin series (`s0_f`) + the index where the real data ends
  const fc = (type === 'line' || type === 'area' || type === 'composed') && !horizontal ? withForecast({ ...prep, rows: thinned }, o) : { rows: thinned, series: prep.series, cut: null };
  const rows = fc.rows;
  const series = prep.series;                       // real series: what gets drawn, legend-ed and coloured
  const colors = seriesColors(o, series.length);
  const config = chartConfig(fc.series, [...colors, ...colors]);   // twins share their series' colour
  const stacked = (type === 'bar' || type === 'area') && o.stacked === true;
  const barStyle = (!horizontal && !stacked ? opt.str(o.barStyle, 'flat') : 'flat') as BarStyle;
  const depth = depthOf(barStyle, opt.num(o.barSize, 0) || 28);
  const dual = o.dualAxis === true && series.length > 1;
  const font = (AXIS_FONT[opt.str(o.axisFontSize, 'sm')] ?? 12) - (compact ? 1 : 0);
  const curve = opt.str(o.curve, 'monotone') as Curve;
  const grid = opt.str(o.grid, 'horizontal');
  const lineWidth = opt.num(o.lineWidth, 2);
  const animate = o.animate !== false && rows.length <= BIG_DATA;   // big data renders instantly: animating thousands of SVG nodes is what makes charts feel slow
  const angle = opt.num(o.xTickAngle, 0);
  const baseline = type === 'line' || type === 'scatter' ? 'auto' : 0;  // bars and areas start at zero unless told otherwise
  const ref = o.refValue === undefined || o.refValue === '' ? null : opt.num(o.refValue, 0);
  const tick = { fontSize: font };
  const fmtAxis = axisFormatter(o);
  const labelMode = opt.str(o.dataLabels, o.showDataLabels === true ? 'some' : 'none');   // some = only while the chart is not crowded
  const labels = !compact && (labelMode === 'all' || (labelMode === 'some' && rows.length <= 40));
  const glow = o.glow === true;
  const fill = fillStyleOf(o, type);
  const ring = opt.str(o.dotStyle, 'solid') === 'ring';
  const yScale = yScaleProps(o, baseline);
  const Chart = type === 'line' ? LineChart : type === 'area' ? AreaChart : type === 'composed' ? ComposedChart : BarChart;
  const axisFor = (i: number) => (horizontal ? undefined : dual && i > 0 ? 'right' : 'left');
  const colorOf = (key: string) => `var(--color-${key})`;
  const radius = opt.num(o.barRadius, 4);

  const labelList = (key: string) => labels && (
    <LabelList dataKey={key} position={horizontal ? 'right' : 'top'} formatter={(v: unknown) => formatValue(v, o)} className="fill-foreground" fontSize={font - 1} />
  );
  const dotProps = (key: string) => (o.dots === true
    ? (ring ? { r: 3.5, fill: 'var(--background)', stroke: colorOf(key), strokeWidth: 2 } : { r: 3, fill: colorOf(key), strokeWidth: 0 })
    : false);
  const active = (key: string) => ({ r: 5, fill: colorOf(key), stroke: 'var(--background)', strokeWidth: 2, style: glowStyle(colorOf(key), glow) });

  const drawBar = (s: { key: string }, i: number) => (
    <Bar key={s.key} dataKey={s.key} yAxisId={axisFor(i)} fill={fillRef(fill, uid, s.key, colorOf(s.key), 'bar')} stackId={stacked ? 'a' : undefined}
      radius={stacked ? 0 : horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0]} barSize={opt.num(o.barSize, 0) || undefined}
      shape={barStyle === 'flat' ? undefined : (p: unknown) => <Bar3D {...(p as object)} color={colorOf(s.key)} variant={barStyle} />}
      background={o.barBackground === true ? { fill: 'var(--muted)', radius } : undefined} isAnimationActive={animate}>{labelList(s.key)}</Bar>
  );
  const drawLine = (s: { key: string }, i: number) => (
    <Line key={s.key} dataKey={s.key} yAxisId={axisFor(i)} type={curve} stroke={colorOf(s.key)} strokeWidth={lineWidth} style={glowStyle(colorOf(s.key), glow)}
      dot={dotProps(s.key)} activeDot={active(s.key)} connectNulls={o.missing === 'interpolate'} isAnimationActive={animate}>{labelList(s.key)}</Line>
  );
  const drawArea = (s: { key: string }, i: number) => (
    <Area key={s.key} dataKey={s.key} yAxisId={axisFor(i)} type={curve} stroke={colorOf(s.key)} strokeWidth={lineWidth} style={glowStyle(colorOf(s.key), glow)}
      stackId={stacked ? 'a' : undefined} dot={dotProps(s.key)} activeDot={active(s.key)} isAnimationActive={animate}
      fill={fill === 'solid' ? colorOf(s.key) : fillRef(fill, uid, s.key, colorOf(s.key), 'area')} fillOpacity={fill === 'solid' ? opt.num(o.fillOpacity, 0.3) : 1}>{labelList(s.key)}</Area>
  );

  // dashed twin of a line / area for the forecast part; same colour, no dots, hidden from the legend
  const drawForecast = (s: { key: string }, i: number) => {
    const k = forecastKey(s.key);
    return type === 'area' ? (
      <Area key={k} dataKey={k} yAxisId={axisFor(i)} type={curve} stroke={colorOf(s.key)} strokeWidth={lineWidth} strokeDasharray="6 5" dot={false} activeDot={false}
        legendType="none" fill={colorOf(s.key)} fillOpacity={0.12} isAnimationActive={animate} />
    ) : (
      <Line key={k} dataKey={k} yAxisId={axisFor(i)} type={curve} stroke={colorOf(s.key)} strokeWidth={lineWidth} strokeDasharray="6 5" dot={false}
        activeDot={active(s.key)} legendType="none" style={glowStyle(colorOf(s.key), glow)} isAnimationActive={animate} />
    );
  };

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <Chart data={rows} onClick={onPick ? (s: { activeLabel?: string | number }) => { if (s?.activeLabel !== undefined) onPick(String(s.activeLabel)); } : undefined} style={onPick ? { cursor: 'pointer' } : undefined} layout={horizontal ? 'vertical' : 'horizontal'} stackOffset={stacked && o.percentStack === true ? 'expand' : undefined}
        margin={{ top: 12 + depth, right: compact ? 4 : 12, left: compact ? 0 : 4, bottom: angle ? 24 : 4 }}>
        {fill !== 'solid' && <FillDefs uid={uid} items={series.map((s) => ({ key: s.key, color: colorOf(s.key) }))} opacity={opt.num(o.fillOpacity, 0.3)} vertical={!horizontal} />}
        {grid !== 'none' && <CartesianGrid vertical={grid === 'vertical' || grid === 'both'} horizontal={grid === 'horizontal' || grid === 'both'} strokeDasharray="3 3" />}
        {horizontal ? (
          <>
            <XAxis type="number" hide={o.showYAxis === false} tick={tick} tickFormatter={fmtAxis} {...yScale} />
            <YAxis type="category" dataKey="x" hide={o.showXAxis === false} tick={tick} width={compact ? 64 : 90} tickLine={false} axisLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="x" hide={o.showXAxis === false} tick={{ ...tick, ...(angle ? { angle, textAnchor: angle < 0 ? 'end' : 'start' } : {}) }}
              tickLine={false} axisLine={false} minTickGap={compact ? 24 : 12} height={angle ? 56 : undefined}
              label={o.xLabel && !compact ? { value: String(o.xLabel), position: 'insideBottom', offset: -2, fontSize: font } : undefined} />
            <YAxis yAxisId="left" hide={o.showYAxis === false} tick={tick} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={compact ? 36 : 48} {...yScale}
              label={o.yLabel && !compact ? { value: String(o.yLabel), angle: -90, position: 'insideLeft', fontSize: font } : undefined} />
            {dual && <YAxis yAxisId="right" orientation="right" tick={tick} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={compact ? 36 : 48} />}
          </>
        )}
        {o.showTooltip !== false && <ChartTooltip cursor={o.tooltipCursor === false ? false : undefined} content={valueTooltip(o, config)} />}
        {o.showLegend !== false && series.length > 1 && <ChartLegend verticalAlign={legendAt(o)} content={<ChartLegendContent />} />}
        {fc.cut !== null && o.forecastShade !== false && rows[fc.cut] && (
          <ReferenceArea x1={rows[fc.cut].x as string} x2={rows[rows.length - 1].x as string} yAxisId="left" fill="var(--muted-foreground)" fillOpacity={0.08} ifOverflow="extendDomain"
            label={{ value: 'Forecast', position: 'insideTopRight', fontSize: font - 1, fill: 'var(--muted-foreground)' }} />
        )}
        {series.map((s, i) => (type === 'bar' ? drawBar(s, i) : type === 'line' ? drawLine(s, i) : type === 'area' ? drawArea(s, i) : i === 0 ? drawBar(s, i) : drawLine(s, i)))}
        {fc.cut !== null && series.map((s, i) => (type === 'composed' && i === 0 ? null : drawForecast(s, i)))}
        {rows[0]?.trend !== undefined && !horizontal && <Line dataKey="trend" yAxisId={axisFor(0)} stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} legendType="none" isAnimationActive={false} />}
        {ref !== null && (horizontal
          ? <ReferenceLine x={ref} stroke="var(--destructive)" strokeDasharray="4 3" label={{ value: String(o.refLabel ?? ''), fontSize: font, fill: 'var(--destructive)' }} />
          : <ReferenceLine y={ref} yAxisId="left" stroke="var(--destructive)" strokeDasharray="4 3" label={{ value: String(o.refLabel ?? ''), position: 'insideTopRight', fontSize: font, fill: 'var(--destructive)' }} />)}
      </Chart>
    </ChartContainer>
  );
}

/** Memoised: the studio re-renders on every keystroke elsewhere; the SVG only redraws when its data or options change. */
export const CartesianChart = memo(CartesianChartBase);
