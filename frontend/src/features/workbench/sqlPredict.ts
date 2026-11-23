import { readStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';

/**
 * Inline "ghost text" SQL suggestions (pure, no React, no AI call → instant).
 * Order: 1) your own past SQL (run history + every notebook cell) that starts like what you typed,
 *        2) finishing the word you are typing (columns / tables / keywords you use most),
 *        3) built-in rules for the next clause (FROM <table>, GROUP BY ALL, JOIN … ON, ORDER BY … DESC …).
 */

export const HISTORY_KEY = 'workbench.sqlHistory';
const HISTORY_MAX = 300;

/** Remember a query that ran successfully (newest first, de-duplicated). */
export function rememberSql(sql: string) {
  const q = sql.trim();
  if (!q) return;
  const prev = readStorage<string[]>(HISTORY_KEY, []).filter((s) => s !== q);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, HISTORY_MAX))); } catch { /* storage full / blocked */ }
}

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'JOIN', 'LEFT JOIN', 'DISTINCT', 'CASE WHEN', 'COUNT(*)', 'DESC', 'ASC', 'AS', 'AND', 'BETWEEN', 'UNION ALL', 'WITH', 'PARTITION BY'];
const AGG = /\b(count|sum|avg|min|max|median|stddev|string_agg|list|quantile_cont|arg_max|arg_min)\s*\(/i;
const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();

export interface Predictor { (before: string): string | null }

/** Build a predictor from the user's corpus (past SQL) and schema `{ table: [columns] }`. */
export function makePredictor(corpus: string[], schema: Record<string, string[]>): Predictor {
  const docs = [...new Set(corpus.map((s) => s.trim()).filter(Boolean))];
  const normDocs = docs.map(norm);
  const tables = Object.keys(schema);
  // how often you use each identifier → your habits rank the word completions
  const freq = new Map<string, number>();
  for (const d of docs) for (const w of d.match(/[A-Za-z_][\w]*/g) ?? []) freq.set(w, (freq.get(w) ?? 0) + 1);
  const words = [...new Set([...tables, ...Object.values(schema).flat(), ...freq.keys(), ...KEYWORDS])]
    .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
  const favTable = (exclude = '') => tables.filter((t) => t !== exclude).sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))[0];

  return (before: string) => {
    const stmt = before.slice(before.lastIndexOf(';') + 1);   // only the statement being typed
    if (!stmt.trim()) return null;
    // 1) your history: a past query that starts exactly like this one → offer the rest of its line
    const key = norm(stmt).trimStart();
    if (key.length >= 4) {
      for (let i = 0; i < docs.length; i++) {
        if (normDocs[i].length > key.length && normDocs[i].startsWith(key)) {
          const rest = restOf(docs[i], key.length);
          if (rest) return rest;
        }
      }
    }
    // 2) finish the current word
    const m = /([A-Za-z_][\w]*)$/.exec(stmt);
    if (m && m[1].length >= 2) {
      const w = m[1];
      const hit = words.find((x) => x.length > w.length && x.toLowerCase().startsWith(w.toLowerCase()));
      if (hit) return /^[A-Z]/.test(hit) && w === w.toLowerCase() && KEYWORDS.includes(hit) ? hit.slice(w.length).toLowerCase() : hit.slice(w.length);
      return null;
    }
    if (!/\s$/.test(stmt) && !/\($/.test(stmt)) return null;
    return nextClause(stmt, schema, favTable);
  };
}

/** The remainder of `doc` after `n` normalised characters, up to the end of that line. */
function restOf(doc: string, n: number): string | null {
  let seen = 0, i = 0, lastSpace = false;
  for (; i < doc.length && seen < n; i++) {     // walk `doc` counting characters as norm() would
    const sp = /\s/.test(doc[i]);
    if (!(sp && lastSpace)) seen++;
    lastSpace = sp;
  }
  while (i < doc.length && /\s/.test(doc[i]) && /\s/.test(doc[i - 1] ?? '')) i++;
  const rest = doc.slice(i).split('\n')[0];
  return rest.trim() ? rest : null;
}

/** Default rules: what usually comes next after the clause just typed. */
function nextClause(stmt: string, schema: Record<string, string[]>, favTable: (ex?: string) => string | undefined): string | null {
  const s = stmt.replace(/\s+/g, ' ');
  const from = /\bfrom\s+("?[\w.]+"?)/i.exec(s)?.[1]?.replace(/"/g, '');
  if (/\(\s*$/.test(s)) return /\b(count)\($/i.test(s) ? '*)' : null;
  if (/^\s*select\s+$/i.test(s)) return favTable() ? `* FROM ${favTable()}` : '*';
  if (/\bfrom\s+$/i.test(s)) return favTable() ?? null;
  if (/\bjoin\s+$/i.test(s)) return favTable(from) ?? null;
  const join = /\bjoin\s+("?[\w.]+"?)\s+(?:as\s+)?(\w+\s+)?$/i.exec(s);
  if (join && from) {
    const right = join[1].replace(/"/g, '');
    const shared = (schema[from] ?? []).find((c) => (schema[right] ?? []).includes(c));
    if (shared) return `ON ${from}.${shared} = ${right}.${shared}`;
  }
  if (/\bwhere\s+$/i.test(s) && from && schema[from]?.length) return `${schema[from][0]} = `;
  if (/\bgroup by all\s+$/i.test(s)) return 'ORDER BY 2 DESC';
  if (/\border by\s+[\w."]+\s+$/i.test(s)) return 'DESC';
  if (/\b(desc|asc)\s+$/i.test(s)) return 'LIMIT 10';
  // a SELECT … FROM table finished: aggregate → GROUP BY ALL, plain → LIMIT
  if (from && new RegExp(`\\bfrom\\s+"?${from.replace(/\./g, '\\.')}"?\\s+$`, 'i').test(s)) {
    return AGG.test(s) && !/\bgroup by\b/i.test(s) ? 'GROUP BY ALL' : 'LIMIT 100';
  }
  return null;
}

/** AI completion on the server's fast model (POST /ai/complete). Empty / failed → null, never throws. */
export async function aiComplete(prefix: string, suffix: string, cells: { name: string; sql: string }[], signal: AbortSignal): Promise<string | null> {
  try {
    const r = await api.post<{ completion: string }>('/ai/complete', { prefix, suffix, cells, examples: readStorage<string[]>(HISTORY_KEY, []).slice(0, 5) }, signal);
    return r.completion || null;
  } catch { return null; }
}
