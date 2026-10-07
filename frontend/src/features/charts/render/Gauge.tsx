import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';

interface Range { from: number; to: number; label: string; color: string }

/** "0-50 Low #dc2626; 50-80 Medium #f59e0b; 80-100 High #16a34a" -> ranges (the gauge's coloured bands). */
export function parseRanges(text: string): Range[] {
  return text.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).flatMap((s) => {
    const m = s.match(/^(-?[\d.]+)\s*(?:-|to|–)\s*(-?[\d.]+)\s*(.*?)\s*(#[0-9a-fA-F]{3,8})?$/);
    return m ? [{ from: Number(m[1]), to: Number(m[2]), label: m[3] || '', color: m[4] || '' }] : [];
  });
}
const FALLBACK = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb'];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(Math.PI - a), cy - r * Math.sin(Math.PI - a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Semicircle gauge: the value against coloured ranges (Metabase's gauge chart). */
export function Gauge({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y } = spec.encoding;
  const last = result.rows[result.rows.length - 1];
  const value = toNumber(last?.[y] ?? last?.[x]);
  const ranges = parseRanges(opt.str(o.gaugeRanges, '0-33 Low; 33-66 Medium; 66-100 High')).map((r, i) => ({ ...r, color: r.color || FALLBACK[i % FALLBACK.length] }));
  const min = ranges.length ? Math.min(...ranges.map((r) => r.from)) : 0;
  const max = ranges.length ? Math.max(...ranges.map((r) => r.to)) : 100;
  const angle = (v: number) => Math.min(Math.max((v - min) / (max - min || 1), 0), 1) * Math.PI;
  const hit = ranges.find((r) => value >= r.from && value <= r.to);
  const w = 300;
  const cx = w / 2;
  const cy = 150;
  const R = 120;
  const nx = cx + (R - 10) * Math.cos(Math.PI - angle(value));
  const ny = cy - (R - 10) * Math.sin(Math.PI - angle(value));
  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${cy + 36}`} className="max-h-full w-full max-w-sm" role="img" aria-label={`Gauge: ${formatValue(value, o)}`}>
        {ranges.map((r, i) => <path key={i} d={arc(cx, cy, R, angle(r.from), angle(r.to))} stroke={r.color} strokeWidth={22} fill="none" />)}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={7} fill="var(--foreground)" />
        <text x={cx - R} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{formatValue(min, o)}</text>
        <text x={cx + R} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{formatValue(max, o)}</text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={24} fontWeight={600} fill="var(--foreground)">{formatValue(value, o)}</text>
      </svg>
      {hit?.label && <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: hit.color }}>{hit.label}</span>}
    </div>
  );
}
