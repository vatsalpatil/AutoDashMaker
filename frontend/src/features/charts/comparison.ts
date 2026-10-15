/** Pure helpers for period-comparison charts (no imports, so node tests can load them). */

/** One category's current vs previous value (e.g. yesterday vs day before). */
export interface Compared { name: string; cur: number; prev: number | null; growth: number | null; share: number }
export type Group = 'stars' | 'rising' | 'watch' | 'laggards';

const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

/** Rows -> current / previous / growth / share, biggest first. `prevCol` names the previous-period column. */
export function compareRows(rows: Record<string, unknown>[], x: string, y: string, prevCol?: string): Compared[] {
  const total = rows.reduce((s, r) => s + num(r[y]), 0) || 1;
  return rows.map((r) => {
    const cur = num(r[y]);
    const prev = prevCol && r[prevCol] != null ? num(r[prevCol]) : null;
    return { name: String(r[x] ?? ''), cur, prev, growth: prev ? (cur - prev) / Math.abs(prev) : null, share: cur / total };
  }).sort((a, b) => b.cur - a.cur);
}

/** Where the "big" and "fast" lines sit. Leave a field out to use the automatic line (average share / overall growth). */
export interface GroupThresholds { bigShare?: number; fastGrowth?: number }

/**
 * Growth-share groups: "big" = share at/above the line (default: the average share 1/n), "fast" = growth at/above the line
 * (default: the overall growth). Both lines can be set by the user, e.g. big = 10% share, fast = +5%.
 */
export function groupRows(rows: Compared[], t: GroupThresholds = {}): { overall: number | null; avgShare: number; bigLine: number; fastLine: number; groupOf: (r: Compared) => Group } {
  const avgShare = 1 / Math.max(rows.length, 1);
  const cur = rows.reduce((s, r) => s + r.cur, 0);
  const prev = rows.reduce((s, r) => s + (r.prev ?? 0), 0);
  const overall = prev ? (cur - prev) / prev : null;
  const bigLine = t.bigShare ?? avgShare;
  const fastLine = t.fastGrowth ?? overall ?? 0;
  return {
    overall, avgShare, bigLine, fastLine,
    groupOf: (r) => {
      const big = r.share >= bigLine;
      const fast = (r.growth ?? 0) >= fastLine;
      return big ? (fast ? 'stars' : 'watch') : (fast ? 'rising' : 'laggards');
    },
  };
}

/** Indian units: ₹28.86 Cr, ₹25.78 L, below a lakh grouped the Indian way (₹46,624). */
export function indian(n: number, decimals?: number): string {
  const a = Math.abs(n);
  const d = decimals ?? 2;
  const body = a >= 1e7 ? `${(a / 1e7).toFixed(d)} Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(d)} L` : new Intl.NumberFormat('en-IN', { maximumFractionDigits: a < 1000 ? (decimals ?? 2) : 0 }).format(a);
  return `${n < 0 ? '-' : ''}₹${body}`;
}
