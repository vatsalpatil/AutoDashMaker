import { fmt } from '@/lib/utils';

export type Opts = Record<string, unknown>;

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
const num = (v: unknown, d: number) => {
  if (v === '' || v == null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
/** Typed readers for the loosely-typed options bag. */
export const opt = { str, num, bool: (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d) };

/** Format a number the way the chart's `numberFormat` / `decimals` / `prefix` / `suffix` options ask. */
export function formatValue(value: unknown, o: Opts = {}): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fmt(value);
  const decimals = o.decimals === undefined || o.decimals === '' ? undefined : num(o.decimals, 0);
  const frac = decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  let out: string;
  switch (o.numberFormat) {
    case 'compact': out = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: decimals ?? 1 }).format(n); break;
    case 'percent': out = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: decimals ?? 1, ...frac }).format(n); break;
    case 'currency': out = new Intl.NumberFormat('en-US', { style: 'currency', currency: str(o.currency, 'USD'), maximumFractionDigits: decimals ?? 0, ...frac }).format(n); break;
    case 'decimal': out = new Intl.NumberFormat('en-US', { ...frac }).format(n); break;
    default: out = decimals === undefined ? fmt(value) : new Intl.NumberFormat('en-US', frac).format(n);
  }
  return `${str(o.prefix, '')}${out}${str(o.suffix, '')}`;
}

/** The number written out in full (never compact/rounded to the chart's format), for hover text. */
export function exactValue(value: unknown, o: Opts = {}): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (value == null || value === '' || Number.isNaN(n)) return value == null ? '—' : String(value);
  return `${str(o.prefix, '')}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(n)}${str(o.suffix, '')}`;
}

export const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
