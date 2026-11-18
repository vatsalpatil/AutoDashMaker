/** Pure helpers for the metric builder and cards (no React, no fetching). */

export const AGGREGATES = [
  { id: 'SUM', label: 'Sum', numericOnly: true },
  { id: 'AVG', label: 'Average', numericOnly: true },
  { id: 'COUNT', label: 'Count rows', numericOnly: false },
  { id: 'COUNT_DISTINCT', label: 'Count unique', numericOnly: false },
  { id: 'MIN', label: 'Minimum', numericOnly: false },
  { id: 'MAX', label: 'Maximum', numericOnly: false },
  { id: 'CUSTOM', label: 'Custom SQL', numericOnly: false },
] as const;
export type AggregateId = (typeof AGGREGATES)[number]['id'];

export const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains'] as const;
export type Operator = (typeof OPERATORS)[number];
export interface FilterRow { column: string; op: Operator; value: string }

const quote = (c: string) => `"${c.replace(/"/g, '""')}"`;
const literal = (v: string) => (v.trim() !== '' && !Number.isNaN(Number(v)) ? v.trim() : `'${v.replace(/'/g, "''")}'`);

export function buildExpression(agg: AggregateId, column: string, custom = ''): string {
  if (agg === 'CUSTOM') return custom.trim();
  if (agg === 'COUNT') return 'COUNT(*)';
  if (!column) return '';
  return agg === 'COUNT_DISTINCT' ? `COUNT(DISTINCT ${quote(column)})` : `${agg}(${quote(column)})`;
}

export function buildFilter({ column, op, value }: FilterRow): string {
  if (!column || value === '') return '';
  return op === 'contains' ? `${quote(column)} ILIKE '%${value.replace(/'/g, "''")}%'` : `${quote(column)} ${op} ${literal(value)}`;
}

export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const isNumericType = (t?: string) => /INT|DOUBLE|FLOAT|DECIMAL|REAL|NUMERIC/i.test(t ?? '');

/** 1.2M, 930K, 42.5 — headline numbers stay short enough for a card. */
export function formatValue(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'number') return String(v);
  return Math.abs(v) >= 1000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Change of the latest period against the one before it, as a percentage (null when it cannot be computed). */
export function trendDelta(trend: { value: number | null }[]): number | null {
  const [a, b] = [trend.at(-2)?.value, trend.at(-1)?.value];
  return typeof a === 'number' && typeof b === 'number' && a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null;
}
