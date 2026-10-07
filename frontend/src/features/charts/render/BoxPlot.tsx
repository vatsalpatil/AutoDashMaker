import { useMeasure } from '@/hooks/useMeasure';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { paletteColors } from '../palettes';

interface Stats { name: string; q1: number; med: number; q3: number; lo: number; hi: number; mean: number; outliers: number[]; all: number[] }

const quantile = (s: number[], p: number) => {
  const i = (s.length - 1) * p;
  const f = Math.floor(i);
  return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (i - f);
};

function stats(name: string, vals: number[], minmax: boolean): Stats {
  const s = [...vals].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const fence = 1.5 * (q3 - q1);
  const inside = minmax ? s : s.filter((v) => v >= q1 - fence && v <= q3 + fence);
  return { name, q1, med: quantile(s, 0.5), q3, lo: inside[0] ?? s[0], hi: inside[inside.length - 1] ?? s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length, outliers: minmax ? [] : s.filter((v) => v < q1 - fence || v > q3 + fence), all: s };
}

/** Box plot per category: quartiles, median, mean marker, whiskers (1.5 x IQR or min/max) and points (Metabase's box plot). */
export function BoxPlot({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const [ref, box] = useMeasure();
  const { x, y } = spec.encoding;
  const groups = new Map<string, number[]>();
  for (const r of result.rows) {
    const v = r[y];
    if (v === null || v === '' || !Number.isFinite(Number(v))) continue;
    const k = x ? String(r[x] ?? '') : 'All';
    groups.set(k, [...(groups.get(k) ?? []), toNumber(v)]);
  }
  const minmax = opt.str(o.whisker, 'iqr') === 'minmax';
  const points = opt.str(o.boxPoints, minmax ? 'none' : 'outliers');
  const list = [...groups].map(([k, v]) => stats(k, v, minmax)).slice(0, 40);
  if (list.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Pick a number column to summarise.</p>;
  const W = Math.max(box.w, 200);
  const pad = { l: 52, r: 12, t: 14, b: 30 };
  const ext: number[] = list.flatMap((s) => [s.lo, s.hi, ...s.outliers, ...(points === 'all' ? s.all : [])]);
  const lo = o.yMin === undefined || o.yMin === '' ? Math.min(...ext) : opt.num(o.yMin, 0);
  const hi = o.yMax === undefined || o.yMax === '' ? Math.max(...ext) : opt.num(o.yMax, 0);
  const log = o.yScale === 'log' && lo > 0;
  const f = (v: number) => (log ? Math.log10(v) : v);
  const sy = (v: number) => pad.t + (1 - (f(v) - f(lo)) / (f(hi) - f(lo) || 1)) * (height - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / list.length;
  const colors = paletteColors(o.palette);
  const nTicks = Math.max(2, opt.num(o.tickCount, 5));
  const ticks = Array.from({ length: nTicks }, (_, i) => lo + ((hi - lo) * i) / (nTicks - 1));
  const compact = { numberFormat: 'compact' };
  const label = opt.str(o.boxLabels, 'median');
  const goal = o.refValue === undefined || o.refValue === '' ? null : opt.num(o.refValue, 0);
  return (
    <div ref={ref} style={{ height }} className="w-full">
      <svg width={W} height={height} role="img" aria-label="Box plot">
        {o.grid !== 'none' && ticks.map((t, i) => (
          <g key={i}><line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeDasharray="3 3" /><text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{formatValue(t, compact)}</text></g>
        ))}
        {goal !== null && <line x1={pad.l} x2={W - pad.r} y1={sy(goal)} y2={sy(goal)} stroke="var(--destructive)" strokeDasharray="4 3" />}
        {list.map((s, i) => {
          const cx = pad.l + band * (i + 0.5);
          const bw = Math.min(band * 0.55, 56);
          const c = colors[i % colors.length];
          return (
            <g key={s.name}>
              <line x1={cx} x2={cx} y1={sy(s.hi)} y2={sy(s.q3)} stroke={c} strokeWidth={1.5} /><line x1={cx} x2={cx} y1={sy(s.q1)} y2={sy(s.lo)} stroke={c} strokeWidth={1.5} />
              <line x1={cx - bw / 4} x2={cx + bw / 4} y1={sy(s.hi)} y2={sy(s.hi)} stroke={c} strokeWidth={1.5} /><line x1={cx - bw / 4} x2={cx + bw / 4} y1={sy(s.lo)} y2={sy(s.lo)} stroke={c} strokeWidth={1.5} />
              <rect x={cx - bw / 2} y={sy(s.q3)} width={bw} height={Math.max(sy(s.q1) - sy(s.q3), 1)} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.5} rx={2} />
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={sy(s.med)} y2={sy(s.med)} stroke={c} strokeWidth={2.5} />
              {o.showMean !== false && <path d={`M ${cx} ${sy(s.mean) - 5} L ${cx + 5} ${sy(s.mean)} L ${cx} ${sy(s.mean) + 5} L ${cx - 5} ${sy(s.mean)} Z`} fill="var(--background)" stroke={c} strokeWidth={1.5} />}
              {(points === 'all' ? s.all : points === 'outliers' ? s.outliers : []).map((v, j) => (
                <circle key={j} cx={cx + ((j * 7919) % 11 - 5) * (points === 'all' ? 2 : 0)} cy={sy(v)} r={2.5} fill={c} fillOpacity={s.outliers.includes(v) ? 0.9 : 0.35} />
              ))}
              {label !== 'none' && (label === 'all' ? [s.lo, s.q1, s.med, s.q3, s.hi] : [s.med]).map((v, j) => (
                <text key={j} x={cx + bw / 2 + 4} y={sy(v) + 3} fontSize={10} fill="var(--foreground)">{formatValue(v, compact)}</text>
              ))}
              <text x={cx} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
