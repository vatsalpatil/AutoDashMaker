/**
 * Chart test bench (dev only): every chart type × every option value, plus seeded random combinations and edge-case data.
 * Cases come from the real option schema, so a new option is tested automatically.
 */
import type { ChartType, QueryResult } from '@/lib/types';
import { KINDS } from '@/features/charts/chartKinds';
import type { Opts } from '@/features/charts/format';
import type { Field } from '@/features/charts/optionBuilders';
import { TABS, sectionsFor } from '@/features/charts/optionSchema';
import { autoEncode } from '@/features/charts/templates';

export interface Case { id: string; type: ChartType; label: string; options: Opts; data: 'main' | 'empty' | 'single' }

const COUNTRIES = ['UK', 'France', 'Canada', 'Germany', 'India', 'USA'];
const CATS = ['Dark', 'Milk', 'Praline', 'White'];
/** 48 rows over 2 years: text, date, numbers (one negative, one zero, one NULL) and a status column. */
export const MAIN: QueryResult = (() => {
  const rows = Array.from({ length: 48 }, (_, i) => ({
    country: COUNTRIES[i % 6], category: CATS[i % 4], status: i % 7 === 0 ? 'Late' : 'On time',
    order_date: `${2024 + Math.floor(i / 24)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    this_month: i === 5 ? -120 : i === 9 ? 0 : 1000 + ((i * 937) % 4000), last_month: i === 11 ? null : 900 + ((i * 613) % 3800),
    qty: 10 + ((i * 13) % 90), margin_pct: ((i * 7) % 40) - 5, target: 5000,
  }));
  return { sql: 'bench', columns: Object.keys(rows[0]), rows, row_count: rows.length, duration_ms: 0, warnings: [], cached: false } as unknown as QueryResult;
})();
export const dataFor = (d: Case['data']): QueryResult => (d === 'empty' ? { ...MAIN, rows: [], row_count: 0 } : d === 'single' ? { ...MAIN, rows: MAIN.rows.slice(0, 1), row_count: 1 } : MAIN);

const TEXT: Record<string, string[]> = {
  cellRules: ['this_month>2000:#16a34a; status=Late:red; *<0:#dc2626', 'garbage rule'],
  columnLabels: ['this_month=This Month; qty=Units'], hiddenColumns: ['qty, target'],
  gaugeRanges: ['0-2000 Low #dc2626; 2000-5000 High #16a34a', 'bad'], valueRules: ['<1000:#dc2626; >=3000:#16a34a'],
  chartTitle: ['A fairly long chart title to test wrapping'], centerText: ['Total'], percentColumn: ['qty'], goalColumn: ['target'],
};

/** Every value worth trying for one option. */
export function valuesOf(f: Field, columns: string[]): unknown[] {
  switch (f.kind) {
    case 'switch': return [true, false];
    case 'select': return (f.options ?? []).map(([v]) => v);
    case 'slider': return [f.min ?? 0, ((f.min ?? 0) + (f.max ?? 100)) / 2, f.max ?? 100];
    case 'number': return [0, 3, 2500, -1, ''];
    case 'color': return ['#e11d48', ''];
    case 'column': return [...columns, ''];
    default: return TEXT[f.key] ?? ['Test', ''];
  }
}

export const fieldsFor = (type: ChartType) => TABS.flatMap((t) => sectionsFor(t, type)).flatMap((s) => s.fields);

function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

export function buildCases(randomPerType = 25): Case[] {
  const out: Case[] = [];
  for (const k of KINDS) {
    const type = k.id;
    const fields = fieldsFor(type);
    out.push({ id: `${type}:default`, type, label: 'defaults', options: {}, data: 'main' });
    out.push({ id: `${type}:empty`, type, label: 'no rows', options: {}, data: 'empty' });
    out.push({ id: `${type}:single`, type, label: 'one row', options: {}, data: 'single' });
    for (const f of fields) for (const v of valuesOf(f, MAIN.columns)) out.push({ id: `${type}:${f.key}=${String(v)}`, type, label: `${f.key} = ${JSON.stringify(v)}`, options: { [f.key]: v }, data: 'main' });
    const r = rng(type.length * 7919 + 17);
    for (let i = 0; i < randomPerType; i++) {
      const options: Opts = {};
      for (const f of fields) if (r() < 0.45) { const vals = valuesOf(f, MAIN.columns); options[f.key] = vals[Math.floor(r() * vals.length)]; }
      out.push({ id: `${type}:random${i}`, type, label: `random #${i}: ${Object.keys(options).length} options`, options, data: i % 5 === 4 ? 'single' : 'main' });
    }
  }
  return out;
}

export const encodingFor = (type: ChartType) => autoEncode(type, MAIN);
