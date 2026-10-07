import { jsonrepair } from 'jsonrepair';
import { JSONPath } from 'jsonpath-plus';

/** Pure JSON helpers behind the API Studio and JSON lab: loose parsing, record detection, flattening, queries, curl import. */

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Row = Record<string, unknown>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface Parsed { value?: Json; repaired: boolean; error?: string }

/** JSON.parse, falling back to an automatic repair (single quotes, trailing commas, comments, unquoted keys…). */
export function parseLoose(text: string): Parsed {
  const src = text.trim();
  if (!src) return { repaired: false, error: 'empty' };
  try {
    return { value: JSON.parse(src) as Json, repaired: false };
  } catch (first) {
    try {
      return { value: JSON.parse(jsonrepair(src)) as Json, repaired: true };
    } catch {
      return { repaired: false, error: (first as Error).message };
    }
  }
}

export const stringify = (v: unknown, indent: number | string = 2) => JSON.stringify(v, null, indent);

/** Same data with every object's keys in alphabetical order (arrays keep their order). */
export function sortKeys(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k] as Json)]));
  return v;
}

export function getPath(value: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((cur, key) => (cur == null ? undefined : (cur as Record<string | number, unknown>)[key]), value);
}

export const pathLabel = (path: (string | number)[]) => path.map(String).join('.');

export interface RecordSet { path: string[]; records: Row[] }

/** The most table-like array of objects in a document (the root when it is one), e.g. `data.items` of an API reply. */
export function detectRecords(value: unknown): RecordSet | null {
  let best: { path: string[]; records: Row[]; score: number } | null = null;
  const visit = (node: unknown, path: string[], depth: number) => {
    if (Array.isArray(node)) {
      const objs = node.filter(isObj);
      if (objs.length > 0 && objs.length >= node.length * 0.8) {
        const keys = new Set(objs.slice(0, 50).flatMap((o) => Object.keys(o)));
        const score = objs.length * Math.min(keys.size, 30) - depth;  // many rows × reasonable width, preferring shallow
        if (!best || score > best.score) best = { path, records: objs, score };
      }
      node.slice(0, 5).forEach((child, i) => visit(child, [...path, String(i)], depth + 1));
    } else if (isObj(node) && depth < 6) {
      for (const [k, v] of Object.entries(node)) visit(v, [...path, k], depth + 1);
    }
  };
  visit(value, [], 0);
  const found = best as { path: string[]; records: Row[] } | null;
  return found ? { path: found.path, records: found.records } : null;
}

/** Every array of objects in a document (up to `limit`), largest first: the choices for "which part is the table?". */
export function listRecordSets(value: unknown, limit = 12): { path: string[]; count: number }[] {
  const found: { path: string[]; count: number }[] = [];
  const visit = (node: unknown, path: string[], depth: number) => {
    if (Array.isArray(node)) {
      const objs = node.filter(isObj).length;
      if (objs > 0 && objs >= node.length * 0.8) found.push({ path, count: objs });
      node.slice(0, 3).forEach((child, i) => visit(child, [...path, String(i)], depth + 1));
    } else if (isObj(node) && depth < 6) {
      for (const [k, v] of Object.entries(node)) visit(v, [...path, k], depth + 1);
    }
  };
  visit(value, [], 0);
  return found.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** `{a: {b: 1}, c: [1,2]}` → `{ 'a.b': 1, c: '[1,2]' }`: nested objects become dotted columns, arrays stay JSON text. */
export function flatten(record: Row, sep = '.', prefix = ''): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(record)) {
    const key = prefix ? `${prefix}${sep}${k}` : k;
    if (isObj(v) && Object.keys(v).length > 0) Object.assign(out, flatten(v, sep, key));
    else out[key] = Array.isArray(v) || isObj(v) ? JSON.stringify(v) : v;
  }
  return out;
}

/** Records → `{columns, rows}` with nested fields flattened; columns are the union of keys in first-seen order. */
export function toTable(records: unknown[], maxRows = 5000): { columns: string[]; rows: Row[] } {
  const rows = records.slice(0, maxRows).map((r) => (isObj(r) ? flatten(r) : { value: r as unknown }));
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
  return { columns, rows };
}

/** JSONPath query (`$.items[?(@.price>10)].name`); returns the matches, or throws with the parser's message. */
export function queryJson(value: unknown, expr: string): unknown {
  const out = JSONPath({ path: expr, json: value as object, wrap: true }) as unknown[];
  // a plain path (no wildcard, filter, slice, union or recursive descent) addresses one value: return it unwrapped
  const multi = /\*|\?\(|\.\.|\[[^\]]*[:,][^\]]*\]/.test(expr);
  return out.length === 1 && !multi ? out[0] : out;
}

/** Short description of what a document is, for the "smart" hint line. */
export function describeJson(value: unknown): string {
  if (Array.isArray(value)) return `array of ${value.length.toLocaleString()} item${value.length === 1 ? '' : 's'}`;
  if (isObj(value)) return `object with ${Object.keys(value).length} key${Object.keys(value).length === 1 ? '' : 's'}`;
  return typeof value;
}

export interface CurlRequest { method: string; url: string; headers: Record<string, string>; body: string }

/** Parse a pasted `curl …` command (Hoppscotch-style import): method, URL, -H headers, -d body, -u basic auth. */
export function parseCurl(cmd: string): CurlRequest | null {
  const text = cmd.trim().replace(/\\\r?\n/g, ' ');
  if (!/^curl\b/i.test(text)) return null;
  const tokens: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.push(m[1] !== undefined ? m[1].replace(/\\(["\\$`])/g, '$1') : (m[2] ?? m[3]));
  const req: CurlRequest = { method: '', url: '', headers: {}, body: '' };
  for (let i = 1; i < tokens.length; i++) {
    const tk = tokens[i];
    const next = () => tokens[++i] ?? '';
    if (tk === '-X' || tk === '--request') req.method = next().toUpperCase();
    else if (tk === '-H' || tk === '--header') { const h = next(); const idx = h.indexOf(':'); if (idx > 0) req.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim(); }
    else if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(tk)) req.body += (req.body ? '&' : '') + next();
    else if (tk === '-u' || tk === '--user') req.headers.Authorization = `Basic ${btoa(next())}`;
    else if (tk === '--url') req.url = next();
    else if (!tk.startsWith('-') && !req.url) req.url = tk;
  }
  if (!req.url) return null;
  if (!req.method) req.method = req.body ? 'POST' : 'GET';
  return req;
}

export interface JsonChange { path: string; kind: 'added' | 'removed' | 'changed'; before?: unknown; after?: unknown }

/** Structural diff of two JSON values (objects by key, arrays by index); paths look like `store.items.0.price`. */
export function diffJson(a: unknown, b: unknown, path: string[] = []): JsonChange[] {
  const here = path.join('.') || '(root)';
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: JsonChange[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) out.push({ path: [...path, i].join('.'), kind: 'added', after: b[i] });
      else if (i >= b.length) out.push({ path: [...path, i].join('.'), kind: 'removed', before: a[i] });
      else out.push(...diffJson(a[i], b[i], [...path, String(i)]));
    }
    return out;
  }
  if (obj(a) && obj(b)) {
    const out: JsonChange[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push({ path: [...path, k].join('.'), kind: 'added', after: b[k] });
      else if (!(k in b)) out.push({ path: [...path, k].join('.'), kind: 'removed', before: a[k] });
      else out.push(...diffJson(a[k], b[k], [...path, k]));
    }
    return out;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ path: here, kind: 'changed', before: a, after: b }];
}
