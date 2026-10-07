import type { ChartConfig } from '@/components/ui/chart';
import { ChartTooltipContent } from '@/components/ui/chart';
import { formatValue, opt, type Opts } from '../format';
import { paletteColors } from '../palettes';
import type { Series } from '../chartData';

export const AXIS_FONT: Record<string, number> = { xs: 10, sm: 12, md: 14 };

/** One colour per series: the palette in order, with `seriesColor` overriding the first. */
export function seriesColors(o: Opts, count: number): string[] {
  const base = paletteColors(o.palette);
  const out = Array.from({ length: count }, (_, i) => base[i % base.length]);
  if (typeof o.seriesColor === 'string' && o.seriesColor && out.length > 0) out[0] = o.seriesColor;
  return out;
}

/** shadcn ChartConfig: exposes each series colour as the CSS var `--color-s0`, `--color-s1`, … */
export function chartConfig(series: Series[], colors: string[]): ChartConfig {
  return Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: colors[i] }]));
}

/** Axis ticks read better compact unless the user chose a format. */
export const axisFormatter = (o: Opts) => (v: unknown) =>
  formatValue(v, o.numberFormat === 'auto' || !o.numberFormat ? { numberFormat: 'compact' } : o);

/** Themed tooltip that formats values with the chart's number format; the marker follows the "Tooltip marker" option. */
export function valueTooltip(o: Opts, config: ChartConfig, extra: Record<string, unknown> = {}) {
  const indicator = opt.str(o.tooltipIndicator, 'dot');
  return (
    <ChartTooltipContent
      {...extra}
      hideIndicator
      formatter={(value, name, item) => {
        const color = (item as { color?: string }).color;
        return (
          <>
            {indicator === 'dot'
              ? <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />
              : <span className="h-4 shrink-0" style={{ width: 0, borderLeft: `3px ${indicator === 'dashed' ? 'dashed' : 'solid'} ${color}` }} />}
            <span className="text-muted-foreground">{String(config[String(name)]?.label ?? name)}</span>
            <span className="ml-auto pl-3 font-mono font-medium tabular-nums">{formatValue(value, o)}</span>
          </>
        );
      }}
    />
  );
}

export const legendAt = (o: Opts): 'top' | 'bottom' => (opt.str(o.legendPosition, 'bottom') === 'top' ? 'top' : 'bottom');

/** Y-axis scale + range from the options: linear / square-root / log, manual min / max, tick count (shared by the cartesian-style charts). */
export function yScaleProps(o: Opts, baseline: number | 'auto') {
  const scale = opt.str(o.yScale, o.logScale === true ? 'log' : 'linear');
  const lo = o.yMin === undefined || o.yMin === '' ? (o.unpinZero === true ? 'auto' : baseline) : opt.num(o.yMin, 0);
  const hi = o.yMax === undefined || o.yMax === '' ? 'auto' : opt.num(o.yMax, 0);
  return {
    scale: scale === 'log' ? ('log' as const) : scale === 'sqrt' ? ('sqrt' as const) : ('auto' as const),
    domain: [scale === 'log' && (lo === 'auto' || lo === 0) ? 1 : lo, hi] as [number | 'auto', number | 'auto'],
    allowDataOverflow: true,
    tickCount: o.tickCount === undefined || o.tickCount === '' ? undefined : opt.num(o.tickCount, 5),
  };
}
