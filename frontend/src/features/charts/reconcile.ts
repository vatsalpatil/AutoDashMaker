/**
 * Reconciliation (pure, no imports): the same key measured by 2-3 sources (e.g. orders per SKU in three systems).
 * A key matches when every source agrees within `tolerance`; diff = max - min across the sources.
 */

export interface ReconRow { key: string; values: (number | null)[]; diff: number; missing: boolean[]; ok: boolean }
export interface ReconSummary {
  rows: ReconRow[];                 // biggest difference first
  totals: number[];                 // per source
  matched: number; mismatched: number; matchRate: number;
  totalDiff: number; avgDiff: number;
  largest: ReconRow | null;
  missing: number[];                // keys absent (null / 0) per source
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** A key matches when its difference is within `tolerance` (an amount) OR within `tolerancePct` % of its largest value. */
export function reconcile(rows: Record<string, unknown>[], key: string, sources: string[], tolerance = 0, tolerancePct = 0): ReconSummary {
  // one row per key: repeated keys (an ungrouped query) are added up per source
  const byKey = new Map<string, (number | null)[]>();
  for (const r of rows) {
    const k = String(r[key] ?? '');
    const prev = byKey.get(k);
    const vals = sources.map((s) => num(r[s]));
    byKey.set(k, prev ? prev.map((p, i) => (p === null && vals[i] === null ? null : (p ?? 0) + (vals[i] ?? 0))) : vals);
  }
  const out: ReconRow[] = [...byKey].map(([k, values]) => {
    const present = values.map((v) => v ?? 0);
    const diff = Math.max(...present) - Math.min(...present);
    const allowed = Math.max(tolerance, (tolerancePct / 100) * Math.max(...present.map(Math.abs)));
    return { key: k, values, diff, missing: values.map((v) => v === null || v === 0), ok: diff <= allowed };
  }).sort((a, b) => b.diff - a.diff);
  const mismatchedRows = out.filter((r) => !r.ok);
  const totalDiff = mismatchedRows.reduce((s, r) => s + r.diff, 0);
  return {
    rows: out,
    totals: sources.map((_, i) => out.reduce((s, r) => s + (r.values[i] ?? 0), 0)),
    matched: out.length - mismatchedRows.length,
    mismatched: mismatchedRows.length,
    matchRate: out.length ? (out.length - mismatchedRows.length) / out.length : 1,
    totalDiff,
    avgDiff: mismatchedRows.length ? totalDiff / mismatchedRows.length : 0,
    largest: mismatchedRows[0] ?? null,
    missing: sources.map((_, i) => out.filter((r) => r.missing[i]).length),
  };
}
