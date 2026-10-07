import { opt, toNumber, type Opts } from './format';
import type { Prepared } from './chartData';

type Row = Record<string, unknown>;

/** Key of the dashed forecast twin of a series (`s0` -> `s0_f`). */
export const forecastKey = (key: string) => `${key}_f`;

/** Least-squares line through (index, value): slope and intercept. */
function fit(values: number[]): { slope: number; icpt: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, icpt: values[0] ?? 0 };
  const sx = (n * (n - 1)) / 2;
  const sxx = ((n - 1) * n * (2 * n - 1)) / 6;
  const sy = values.reduce((a, b) => a + b, 0);
  const sxy = values.reduce((a, v, i) => a + i * v, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  return { slope, icpt: (sy - slope * sx) / n };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The X label after `last` (and the one before it, to learn the step): numbers count on, dates move by the same step. */
function nextX(prev: unknown, last: unknown, i: number): string {
  const a = Number(prev);
  const b = Number(last);
  if (Number.isFinite(a) && Number.isFinite(b) && String(last).trim() !== '') return String(b + (b - a || 1));
  const s = String(last);
  const month = /^(\d{4})-(\d{2})$/.exec(s);
  if (month) {
    const d = new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1 + i, 1));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const t0 = Date.parse(s);
  if (day && Number.isFinite(t0)) {
    const t1 = Date.parse(String(prev));
    const step = Number.isFinite(t1) && t0 > t1 ? t0 - t1 : 86_400_000;
    const d = new Date(t0 + step * i);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return `+${i}`;
}

export interface Forecasted { rows: Row[]; series: Prepared['series']; cut: number | null }

/**
 * ReUI-style forecast: the last N points (tail mode) or N extra points continuing the recent trend (project mode) are drawn
 * as a dashed twin of each series, with the join point shared so the line stays connected. `cut` is the index of the last
 * real point; the shaded zone starts there.
 */
export function withForecast(prep: Prepared, o: Opts): Forecasted {
  const n = Math.floor(opt.num(o.forecastPoints, 0));
  const { rows, series } = prep;
  if (n <= 0 || rows.length < 3) return { rows, series, cut: null };
  const project = opt.str(o.forecastMode, 'tail') === 'project';
  let out: Row[] = rows.map((r) => ({ ...r }));
  let cut: number;

  if (project) {
    cut = rows.length - 1;
    const fits = series.map((s) => {
      const recent = rows.slice(-24).map((r) => toNumber(r[s.key]));
      return { key: s.key, ...fit(recent), len: recent.length };
    });
    for (let i = 1; i <= n; i++) {
      const prev = out[out.length - 2]?.x ?? out[out.length - 1].x;
      const row: Row = { x: nextX(prev, out[out.length - 1].x, 1) };
      for (const f of fits) row[forecastKey(f.key)] = f.icpt + f.slope * (f.len - 1 + i);
      out.push(row);
    }
  } else {
    cut = Math.max(1, rows.length - 1 - n);
  }
  // the join point belongs to both lines; real values stop after it, forecast values start at it
  out = out.map((r, i) => {
    const row: Row = { ...r };
    for (const s of series) {
      const fk = forecastKey(s.key);
      if (!project && i >= cut) row[fk] = r[s.key];
      if (project && i === cut) row[fk] = r[s.key];
      if (i > cut) row[s.key] = null;
    }
    return row;
  });
  return {
    rows: out,
    series: [...series, ...series.map((s) => ({ key: forecastKey(s.key), label: `${s.label} (forecast)` }))],
    cut,
  };
}
