/**
 * Pinned filters (pure, no imports, so node tests can load it): the dashboard owner pins fields as labelled dropdowns
 * ("All Years", "All Countries") with a scope: every tab, or one tab. Viewers pick values, then Apply / Reset.
 */

export type PinnedKind = 'select' | 'year' | 'month';
export interface PinnedFilter { id: string; field: string; label: string; kind: PinnedKind; scope: string }   // scope 'all' or a page id
export type PinnedValues = Record<string, string>;   // filter id -> chosen value ('' or missing = all)

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE = /^\d{4}-\d{2}/;

export const isDateLike = (values: Iterable<unknown>) => { let n = 0; for (const v of values) { if (!DATE.test(String(v))) return false; n += 1; } return n > 0; };

/** The pinned filters that apply on a tab: the all-tabs ones plus that tab's own. */
export const inScope = (filters: PinnedFilter[], page: string) => filters.filter((f) => f.scope === 'all' || f.scope === page);

/** Does one row pass the chosen values? Filters on columns the row does not have are skipped (they don't apply to it). */
export function rowPasses(row: Record<string, unknown>, filters: PinnedFilter[], values: PinnedValues): boolean {
  for (const f of filters) {
    const want = values[f.id];
    if (!want || !(f.field in row)) continue;
    const v = String(row[f.field] ?? '');
    const got = f.kind === 'year' ? v.slice(0, 4) : f.kind === 'month' ? v.slice(5, 7) : v;
    if (got !== want) return false;
  }
  return true;
}

/** Dropdown options for a filter from the values seen in the widgets' data. */
export function optionsFor(kind: PinnedKind, seen: Iterable<string>): { value: string; label: string }[] {
  const all = [...new Set(seen)];
  if (kind === 'year') return [...new Set(all.filter((v) => DATE.test(v)).map((v) => v.slice(0, 4)))].sort().reverse().map((y) => ({ value: y, label: y }));
  if (kind === 'month') return MONTHS.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));
  return all.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((v) => ({ value: v, label: v }));
}

/** "All …" label: Country -> All Countries, Year -> All Years, Status -> All Status. */
export const allLabel = (label: string) => `All ${/s$/i.test(label) ? label : /[^aeiou]y$/i.test(label) ? `${label.slice(0, -1)}ies` : `${label}s`}`;

/** Plain-language summary of what is applied ("Year 2024 · Country UK"), for the "as of" line. */
export const summary = (filters: PinnedFilter[], values: PinnedValues) => filters.filter((f) => values[f.id])
  .map((f) => `${f.label} ${f.kind === 'month' ? MONTHS[Number(values[f.id]) - 1] : values[f.id]}`).join(' · ');
