/**
 * Time breakdown model (pure, no imports, so node tests can load it): one row per item, one column per period, where a
 * year can be expanded into its months and a month into its days, plus a Total column and a Total footer row.
 */

export type Level = 'year' | 'month' | 'day';
export interface TimeCol { key: string; label: string; level: Level; year: string; month?: string; expandable: boolean; expanded?: boolean }
export interface TBRow { id: string; attrs: Record<string, unknown>; cells: Map<string, number[]>; all: number[] }
export interface TimeBreakdown { rows: TBRow[]; years: string[]; monthsOf: Map<string, string[]>; daysOf: Map<string, string[]>; splits: string[] }

/** Cell key of a period inside one split group (e.g. portal 'Amazon' × '2026'). */
export const splitKey = (split: string, key: string) => `${split}§${key}`;

/** Shown for a detail column whose value differs between an item's rows (e.g. a brand sold in several countries). */
export const SEVERAL = 'several';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };

/** '2026-01-05…' / Date / epoch -> ['2026', '2026-01', '2026-01-05'], or null when it is not a date. */
export function dateParts(v: unknown): [string, string, string] | null {
  if (v == null || v === '') return null;
  const s = v instanceof Date ? v.toISOString() : typeof v === 'number' ? new Date(v).toISOString() : String(v);
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return null;
  const day = m[3] ?? '01';
  return [m[1], `${m[1]}-${m[2]}`, `${m[1]}-${m[2]}-${day}`];
}

const push = (map: Map<string, number[]>, k: string, v: number) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };
const addSorted = (m: Map<string, string[]>, k: string, v: string) => { const a = m.get(k) ?? []; if (!a.includes(v)) { a.push(v); a.sort(); } m.set(k, a); };

/** Group query rows by item; every value is filed under its year, month and day bucket. Attribute columns keep the first value. */
export function buildBreakdown(rows: Record<string, unknown>[], item: string, date: string, measure: string, attrs: string[], split = ''): TimeBreakdown {
  const byId = new Map<string, TBRow>();
  const years: string[] = [];
  const monthsOf = new Map<string, string[]>();
  const daysOf = new Map<string, string[]>();
  const splits: string[] = [];
  for (const r of rows) {
    const id = String(r[item] ?? '');
    let row = byId.get(id);
    if (!row) { row = { id, attrs: Object.fromEntries(attrs.map((a) => [a, r[a]])), cells: new Map(), all: [] }; byId.set(id, row); }
    else for (const a of attrs) if (row.attrs[a] !== SEVERAL && String(row.attrs[a] ?? '') !== String(r[a] ?? '')) row.attrs[a] = SEVERAL;   // never show one value for many
    const v = num(r[measure]);
    const parts = dateParts(r[date]);
    if (v === null || !parts) continue;
    const [y, m, d] = parts;
    push(row.cells, y, v); push(row.cells, m, v); push(row.cells, d, v);
    row.all.push(v);
    if (split) {   // the same value also filed under its split group
      const sv = String(r[split] ?? '(blank)');
      if (!splits.includes(sv)) splits.push(sv);
      for (const k of [y, m, d, '__total']) push(row.cells, splitKey(sv, k), v);
    }
    if (!years.includes(y)) years.push(y);
    addSorted(monthsOf, y, m); addSorted(daysOf, m, d);
  }
  years.sort();
  splits.sort();
  return { rows: [...byId.values()], years, monthsOf, daysOf, splits };
}

/** The visible period columns for the current expansion state (a set of expanded year / month keys). */
export function timeColumns(tb: TimeBreakdown, open: Set<string>): TimeCol[] {
  const cols: TimeCol[] = [];
  for (const y of tb.years) {
    const months = tb.monthsOf.get(y) ?? [];
    if (!open.has(y)) { cols.push({ key: y, label: y, level: 'year', year: y, expandable: months.length > 1 || (tb.daysOf.get(months[0] ?? '')?.length ?? 0) > 1 }); continue; }
    for (const m of months) {
      const days = tb.daysOf.get(m) ?? [];
      const label = `${MON[Number(m.slice(5, 7)) - 1]}-${m.slice(2, 4)}`;
      if (!open.has(m)) { cols.push({ key: m, label, level: 'month', year: y, month: m, expandable: days.length > 1 }); continue; }
      for (const d of days) cols.push({ key: d, label: `${d.slice(8, 10)} ${label}`, level: 'day', year: y, month: m, expandable: false });
    }
  }
  return cols;
}

/** One cell: the item's values in that period, aggregated; null = no data (shown as a dash). */
export const cellValue = (row: TBRow, key: string, agg: (v: number[]) => number): number | null => {
  const vals = key === '__total' ? row.all : row.cells.get(key);   // split totals live in cells as `split§__total`
  return vals && vals.length ? agg(vals) : null;
};

/** Footer: the same aggregation over every row's values in that period. */
export function footerValue(rows: TBRow[], key: string, agg: (v: number[]) => number): number | null {
  const vals = rows.flatMap((r) => (key === '__total' ? r.all : r.cells.get(key) ?? []));
  return vals.length ? agg(vals) : null;
}
