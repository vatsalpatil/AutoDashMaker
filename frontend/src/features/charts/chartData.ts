import type { ChartSpec, QueryResult } from '@/lib/types';
import { opt, toNumber, type Opts } from './format';

type Row = Record<string, unknown>;
export type Agg = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface Series { key: string; label: string }
/** Chart-ready data: one row per X value, `x` plus `s0..sN` (one numeric column per series). */
export interface Prepared { rows: Row[]; series: Series[] }

const MAX_SERIES = 12;

export const measuresOf = (spec: ChartSpec): string[] => {
  const e = spec.encoding;
  const list = e.ys?.length ? e.ys : [e.y];
  return list.filter(Boolean);
};

export function aggregate(values: number[], agg: Agg): number {
  if (agg === 'count') return values.length;
  if (values.length === 0) return 0;
  switch (agg) {
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

/** Groups rows by the value of `field`, keeping first-seen order. */
function groupBy(rows: Row[], field: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r[field] ?? '');
    const bucket = out.get(k);
    if (bucket) bucket.push(r); else out.set(k, [r]);
  }
  return out;
}

/** Least-squares line through (index, value); returns the fitted value for each row. */
function trend(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  const sx = (n * (n - 1)) / 2;
  const sxx = ((n - 1) * n * (2 * n - 1)) / 6;
  const sy = values.reduce((a, b) => a + b, 0);
  const sxy = values.reduce((a, v, i) => a + i * v, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const icpt = (sy - slope * sx) / n;
  return values.map((_, i) => icpt + slope * i);
}

/** Empty values: show as zero (default), leave a gap in the line, or draw a straight line across them (Metabase's "replace missing values"). */
function fillMissing(rows: Row[], series: Series[], mode: string): Row[] {
  if (mode === 'gap') return rows;
  const out = rows.map((r) => ({ ...r }));
  for (const s of series) {
    const key = s.key;
    out.forEach((r, i) => {
      if (r[key] !== null && r[key] !== undefined) return;
      if (mode !== 'interpolate') { r[key] = 0; return; }
      let a = i - 1;
      while (a >= 0 && (out[a][key] === null || out[a][key] === undefined)) a--;
      let b = i + 1;
      while (b < out.length && (out[b][key] === null || out[b][key] === undefined)) b++;
      if (a < 0 || b >= out.length) { r[key] = a >= 0 ? out[a][key] : b < out.length ? out[b][key] : 0; return; }
      r[key] = toNumber(out[a][key]) + ((toNumber(out[b][key]) - toNumber(out[a][key])) * (i - a)) / (b - a);
    });
  }
  return out;
}

/** Aggregation / pivot-by-colour / sort / top-N / running total / trend, driven by the chart options. */
export function prepare(result: QueryResult, spec: ChartSpec, o: Opts): Prepared {
  const { x, color } = spec.encoding;
  const measures = measuresOf(spec);
  const family = spec.type === 'scatter' ? 'scatter' : 'other';
  let agg = opt.str(o.agg, 'none') as Agg;
  const src = result.rows;
  let rows: Row[];
  let series: Series[];

  if (color && family !== 'scatter' && measures[0]) {
    if (agg === 'none') agg = 'sum';
    const colors = [...new Set(src.map((r) => String(r[color] ?? '')))].slice(0, MAX_SERIES);
    series = colors.map((c, i) => ({ key: `s${i}`, label: c || '(blank)' }));
    rows = [...groupBy(src, x)].map(([xv, rs]) => {
      const row: Row = { x: xv };
      colors.forEach((c, i) => {
        row[`s${i}`] = aggregate(rs.filter((r) => String(r[color] ?? '') === c).map((r) => toNumber(r[measures[0]])), agg);
      });
      return row;
    });
  } else {
    series = measures.map((m, i) => ({ key: `s${i}`, label: m }));
    const toRow = (xv: unknown, rs: Row[]): Row => {
      const row: Row = { x: xv };
      measures.forEach((m, i) => { row[`s${i}`] = agg === 'none' ? (rs[0]?.[m] == null || rs[0]?.[m] === '' ? null : toNumber(rs[0]?.[m])) : aggregate(rs.map((r) => toNumber(r[m])), agg); });
      return row;
    };
    rows = agg === 'none' ? src.map((r) => toRow(r[x], [r])) : [...groupBy(src, x)].map(([xv, rs]) => toRow(xv, rs));
  }

  rows = fillMissing(rows, series, opt.str(o.missing, 'zero'));

  const sortBy = opt.str(o.sortBy, 'none');
  if (sortBy !== 'none') {
    const sign = opt.str(o.sortDir, 'desc') === 'asc' ? 1 : -1;
    const total = (r: Row) => series.reduce((a, s) => a + toNumber(r[s.key]), 0);
    rows = [...rows].sort((a, b) => sign * (sortBy === 'x'
      ? String(a.x).localeCompare(String(b.x), undefined, { numeric: true })
      : total(a) - total(b)));
  }
  const limit = opt.num(o.limit, 0);
  if (limit > 0) rows = rows.slice(0, limit);

  if (o.cumulative === true) {
    const run: Record<string, number> = {};
    rows = rows.map((r) => {
      const next: Row = { ...r };
      for (const s of series) { run[s.key] = (run[s.key] ?? 0) + toNumber(r[s.key]); next[s.key] = run[s.key]; }
      return next;
    });
  }
  if (o.trendline === true && series.length > 0) {
    const fit = trend(rows.map((r) => toNumber(r.s0)));
    rows = rows.map((r, i) => ({ ...r, trend: fit[i] }));
  }
  return { rows, series };
}

export interface Pivoted {
  rowKeys: string[];
  colKeys: string[];
  cell: (r: string, c: string) => number | null;
  rowTotal: (r: string) => number;
  colTotal: (c: string) => number;
  grand: number;
  min: number;
  max: number;
}

/** Cross-tab: rows × columns, each cell the aggregate of the value field. */
export function pivot(result: QueryResult, spec: ChartSpec, o: Opts): Pivoted {
  const { x, color, y } = spec.encoding;
  const agg = opt.str(o.pivotAgg, 'sum') as Agg;
  const rowKeys: string[] = [];
  const colKeys: string[] = [];
  const buckets = new Map<string, number[]>();
  const push = (k: string, v: number) => { const b = buckets.get(k); if (b) b.push(v); else buckets.set(k, [v]); };
  const cols = new Set<string>();
  const rowsSeen = new Set<string>();
  for (const r of result.rows) {
    const rk = String(r[x] ?? '');
    const ck = color ? String(r[color] ?? '') : y;
    if (!rowsSeen.has(rk)) { rowsSeen.add(rk); rowKeys.push(rk); }
    if (!cols.has(ck)) { cols.add(ck); colKeys.push(ck); }
    const v = toNumber(r[y]);
    push(`${rk}\u0001${ck}`, v);
    push(`${rk}\u0001*`, v);
    push(`*\u0001${ck}`, v);
    push('*\u0001*', v);
  }
  const val = (k: string) => aggregate(buckets.get(k) ?? [], agg);
  const cells = rowKeys.flatMap((r) => colKeys.map((c) => buckets.has(`${r}\u0001${c}`) ? val(`${r}\u0001${c}`) : null));
  const nums = cells.filter((v): v is number => v !== null);
  return {
    rowKeys, colKeys,
    cell: (r, c) => (buckets.has(`${r}\u0001${c}`) ? val(`${r}\u0001${c}`) : null),
    rowTotal: (r) => val(`${r}\u0001*`),
    colTotal: (c) => val(`*\u0001${c}`),
    grand: val('*\u0001*'),
    min: nums.length ? Math.min(...nums) : 0,
    max: nums.length ? Math.max(...nums) : 0,
  };
}

/** Numeric-looking columns, used to auto-assign fields when applying a template. */
export function columnKinds(result: QueryResult): { numeric: string[]; other: string[] } {
  const numeric: string[] = [];
  const other: string[] = [];
  for (const c of result.columns) {
    const sample = result.rows.slice(0, 30).map((r) => r[c]).filter((v) => v != null && v !== '');
    const isNum = sample.length > 0 && sample.every((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))));
    (isNum ? numeric : other).push(c);
  }
  return { numeric, other };
}

/** Rows beyond which a chart stops animating and long series are thinned (a 50 000-point line is a smear, and slow). */
export const BIG_DATA = 400;
const MAX_POINTS = 900;

/**
 * Min/max decimation: keeps the first and last row and, per bucket, the lowest and highest first-series value, in order.
 * Spikes survive (unlike plain striding) and the result has at most ~2×max rows.
 */
export function thinRows(rows: Row[], max = MAX_POINTS): Row[] {
  if (rows.length <= max * 2) return rows;
  const size = Math.ceil(rows.length / max);
  const keep = new Set<number>([0, rows.length - 1]);
  for (let start = 0; start < rows.length; start += size) {
    let lo = start;
    let hi = start;
    const end = Math.min(start + size, rows.length);
    for (let i = start; i < end; i++) {
      const v = toNumber(rows[i].s0);
      if (v < toNumber(rows[lo].s0)) lo = i;
      if (v > toNumber(rows[hi].s0)) hi = i;
    }
    keep.add(lo);
    keep.add(hi);
  }
  return [...keep].sort((a, b) => a - b).map((i) => rows[i]);
}
