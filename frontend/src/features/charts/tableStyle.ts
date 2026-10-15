/**
 * Table styling options shared by Table, Pivot and Time breakdown (pure, no imports, so node tests can load it).
 *   Colour rules:  "revenue>100000:#16a34a; status=Late:#dc2626; *<0:red"   (column `*` = any column)
 *   Renames:       "revenue=Revenue (₹); qty=Units"
 *   Hidden:        "order_id, customer_id"
 */

export interface CellRule { col: string; op: '<' | '<=' | '>' | '>=' | '=' | '!=' | 'contains'; value: string; color: string }

const RULE = /^\s*([\w*. -]+?)\s*(<=|>=|!=|<|>|=|~)\s*([^:]+?)\s*:\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*$/;

export function parseRules(text: unknown): CellRule[] {
  return String(text ?? '').split(';').map((r) => RULE.exec(r)).filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ col: m[1].trim(), op: (m[2] === '~' ? 'contains' : m[2]) as CellRule['op'], value: m[3].trim(), color: m[4] }));
}

/** The colour of the first rule that matches this cell, if any. Numbers compare as numbers, text as text. */
export function ruleColor(rules: CellRule[], col: string, v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  for (const r of rules) {
    if (r.col !== '*' && r.col.toLowerCase() !== col.toLowerCase()) continue;
    const n = Number(v), t = Number(r.value);
    const numeric = Number.isFinite(n) && Number.isFinite(t) && String(v).trim() !== '';
    const s = String(v).toLowerCase(), w = r.value.toLowerCase();
    const hit = r.op === 'contains' ? s.includes(w)
      : r.op === '=' ? (numeric ? n === t : s === w)
      : r.op === '!=' ? (numeric ? n !== t : s !== w)
      : numeric && (r.op === '<' ? n < t : r.op === '<=' ? n <= t : r.op === '>' ? n > t : n >= t);
    if (hit) return r.color;
  }
  return undefined;
}

export function parseLabels(text: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(text ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export const parseList = (text: unknown) => String(text ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Width of an in-cell data bar (0..1) for a value within its column's range. */
export const barFraction = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) && max > 0 ? Math.max(0, Math.min(1, Math.abs(n) / max)) : 0; };

/** Inline style for a cell from the colour rules (text colour, or a tinted background when `fill`). */
export function ruleStyle(rules: CellRule[], col: string, v: unknown, fill: boolean): Record<string, string> | undefined {
  const c = ruleColor(rules, col, v);
  return c ? (fill ? { background: `color-mix(in oklab, ${c} 22%, transparent)` } : { color: c }) : undefined;
}
