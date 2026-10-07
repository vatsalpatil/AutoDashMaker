// Pure model of the visual query builder: the spec sent to /api/qb/*, option lists and small helpers.

export type Ref = string | { t: string; c: string; as?: string };
export type Kind = 'num' | 'time' | 'bool' | 'text';
export interface QbFilter { col?: Ref; op: string; value?: unknown; value2?: unknown }
export interface QbAgg { fn: string; col?: Ref; as?: string; expr?: string; where?: QbFilter[] }
export interface QbBreakout { col: Ref; bucket?: string; as?: string }
export interface QbWindow { fn: string; col?: Ref; partition?: Ref[]; order?: Ref; order_dir?: 'asc' | 'desc'; n?: number; as?: string }
export interface QbJoin { table: string; type: string; on: { left: Ref; right: Ref }[] }
export interface QbStage {
  sql?: string;   // a whole query kept as the first stage (opened from the Workbench)
  table?: string; joins?: QbJoin[]; custom?: { name: string; expr: string; hidden?: boolean }[];
  filters?: QbFilter[]; filter_mode?: 'and' | 'or';
  aggregations?: QbAgg[]; breakouts?: QbBreakout[]; having?: QbFilter[];
  windows?: QbWindow[]; columns?: Ref[]; distinct?: boolean;
  sort?: { col: Ref; dir: 'asc' | 'desc' }[]; limit?: number;
}
export interface QbSpec { stages: QbStage[] }
export interface QbColumn { name: string; dtype: string }
export interface QbTable { name: string; id: string; kind?: string; row_count?: number; columns: QbColumn[] }
export interface QbLink { left: string; left_column: string; right: string; right_column: string; type: string; declared: boolean }
export interface QbSchema { tables: QbTable[]; links: QbLink[] }
/** A column a step can pick, in a form the pickers understand. */
export interface ColOpt { key: string; label: string; ref: Ref; kind: Kind; table?: string; column: string }

export const hasSource = (s: QbSpec) => !!(s.stages[0]?.table || s.stages[0]?.sql);
export const emptySpec = (): QbSpec => ({ stages: [{ limit: 1000 }] });

export function kindOf(dtype = ''): Kind {
  const d = dtype.toLowerCase();
  if (/date|time|interval/.test(d)) return 'time';
  if (/bool/.test(d)) return 'bool';
  if (/int|float|double|decimal|numeric|real|number|hugeint/.test(d)) return 'num';
  return 'text';
}

export const refKey = (r: Ref | undefined): string => (r === undefined ? '' : typeof r === 'string' ? `s:${r}` : `o:${r.t}:${r.c}`);
export const refName = (r: Ref | undefined): string => (r === undefined ? '' : typeof r === 'string' ? r : r.c);

const OPS_NUM = ['=', '!=', '>', '>=', '<', '<=', 'between', 'in', 'not_in', 'is_null', 'not_null'];
const OPS_TEXT = ['contains', 'not_contains', '=', 'ieq', '!=', 'starts_with', 'ends_with', 'in', 'not_in', 'is_empty', 'not_empty', 'is_null', 'not_null', 'regex'];
const OPS_TIME = ['last_n_days', 'next_n_days', 'today', 'this_week', 'this_month', 'this_quarter', 'this_year', '=', '>', '<', '>=', '<=', 'between', 'is_null', 'not_null'];
const OPS_BOOL = ['is_true', 'is_false', 'is_null', 'not_null'];
export const opsFor = (k: Kind): string[] => [...({ num: OPS_NUM, text: OPS_TEXT, time: OPS_TIME, bool: OPS_BOOL }[k]), 'expr'];
export const OP_LABEL: Record<string, string> = {
  '=': 'is', ieq: 'is (any upper/lower case)', '!=': 'is not', '>': '>', '>=': '≥', '<': '<', '<=': '≤', between: 'between', in: 'is one of', not_in: 'is none of',
  contains: 'contains', not_contains: 'does not contain', starts_with: 'starts with', ends_with: 'ends with', regex: 'matches regex',
  is_null: 'is empty (null)', not_null: 'is not empty', is_empty: 'is blank', not_empty: 'is not blank', is_true: 'is true', is_false: 'is false',
  last_n_days: 'in the last N days', next_n_days: 'in the next N days', today: 'is today', this_week: 'is this week',
  this_month: 'is this month', this_quarter: 'is this quarter', this_year: 'is this year', expr: 'custom SQL…',
};
export const UNARY_OPS = new Set(['is_null', 'not_null', 'is_empty', 'not_empty', 'is_true', 'is_false', 'today', 'this_week', 'this_month', 'this_quarter', 'this_year']);

export const AGG_FNS: { id: string; label: string; needsCol: boolean }[] = [
  { id: 'count', label: 'Count of rows', needsCol: false }, { id: 'count_distinct', label: 'Distinct values of', needsCol: true },
  { id: 'count_col', label: 'Count of non-empty', needsCol: true }, { id: 'sum', label: 'Sum of', needsCol: true },
  { id: 'avg', label: 'Average of', needsCol: true }, { id: 'median', label: 'Median of', needsCol: true },
  { id: 'min', label: 'Minimum of', needsCol: true }, { id: 'max', label: 'Maximum of', needsCol: true },
  { id: 'stddev', label: 'Std deviation of', needsCol: true }, { id: 'variance', label: 'Variance of', needsCol: true },
  { id: 'p25', label: '25th percentile of', needsCol: true }, { id: 'p75', label: '75th percentile of', needsCol: true },
  { id: 'p90', label: '90th percentile of', needsCol: true }, { id: 'p95', label: '95th percentile of', needsCol: true },
  { id: 'p99', label: '99th percentile of', needsCol: true }, { id: 'mode', label: 'Most common of', needsCol: true },
  { id: 'first', label: 'First of', needsCol: true }, { id: 'last', label: 'Last of', needsCol: true },
  { id: 'list', label: 'List of values of', needsCol: true }, { id: 'range', label: 'Range (max − min) of', needsCol: true },
  { id: 'null_count', label: 'Empty count of', needsCol: true }, { id: 'null_pct', label: '% empty of', needsCol: true },
  { id: 'expr', label: 'Custom SQL aggregate', needsCol: false },
];
export const BUCKETS: Record<Kind, [string, string][]> = {
  time: [['none', 'Exact value'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['hour', 'Hour'],
    ['year_month', 'Year-month (text)'], ['day_of_week', 'Day of week'], ['month_of_year', 'Month name'], ['hour_of_day', 'Hour of day']],
  num: [['none', 'Exact value'], ['bin:10', 'Bins of 10'], ['bin:100', 'Bins of 100'], ['bin:1000', 'Bins of 1000'], ['bin:0.1', 'Bins of 0.1']],
  text: [['none', 'Exact value'], ['text_length', 'Text length']],
  bool: [['none', 'Exact value']],
};
export const WINDOW_FNS: { id: string; label: string; needsCol: boolean; n?: string }[] = [
  { id: 'running_sum', label: 'Running total', needsCol: true }, { id: 'running_avg', label: 'Running average', needsCol: true },
  { id: 'running_count', label: 'Running count', needsCol: false }, { id: 'moving_avg', label: 'Moving average', needsCol: true, n: 'rows back' },
  { id: 'moving_sum', label: 'Moving sum', needsCol: true, n: 'rows back' }, { id: 'rank', label: 'Rank', needsCol: false },
  { id: 'dense_rank', label: 'Dense rank', needsCol: false }, { id: 'row_number', label: 'Row number', needsCol: false },
  { id: 'ntile', label: 'Bucket (ntile)', needsCol: false, n: 'buckets' }, { id: 'pct_rank', label: 'Percent rank', needsCol: false },
  { id: 'lag', label: 'Previous value', needsCol: true, n: 'rows back' }, { id: 'lead', label: 'Next value', needsCol: true, n: 'rows ahead' },
  { id: 'diff_prev', label: 'Change vs previous', needsCol: true, n: 'rows back' }, { id: 'pct_change', label: '% change vs previous', needsCol: true, n: 'rows back' },
  { id: 'pct_of_total', label: '% of total', needsCol: true }, { id: 'z_score', label: 'Z-score (outlier score)', needsCol: true },
  { id: 'first_value', label: 'First value in group', needsCol: true }, { id: 'last_value', label: 'Last value in group', needsCol: true },
];
export const JOIN_TYPES: [string, string][] = [
  ['left', 'Left join (keep all left rows)'], ['inner', 'Inner join (only matches)'], ['right', 'Right join'],
  ['full', 'Full outer join'], ['cross', 'Cross join (all pairs)'],
];

/** Columns a step can use: first stage = every joined table + custom columns; later stages = the previous stage's output. */
export function columnsFor(spec: QbSpec, stage: number, schema: QbSchema | null, prev: { name: string; kind: Kind }[]): ColOpt[] {
  const st = spec.stages[stage];
  const custom: ColOpt[] = (st.custom ?? []).filter((c) => c.name).map((c) => ({ key: refKey(c.name), label: `${c.name} (custom)`, ref: c.name, kind: 'num' as Kind, column: c.name }));
  if (stage > 0) return [...prev.map((c) => ({ key: refKey(c.name), label: c.name, ref: c.name as Ref, kind: c.kind, column: c.name })), ...custom];
  const names = [st.table, ...(st.joins ?? []).map((j) => j.table)];
  const multi = names.filter(Boolean).length > 1;
  const out: ColOpt[] = [];
  names.forEach((tn, i) => {
    const t = schema?.tables.find((x) => x.name === tn);
    t?.columns.forEach((c) => {
      const ref: Ref = { t: `t${i}`, c: c.name };
      out.push({ key: refKey(ref), label: multi ? `${t.name} › ${c.name}` : c.name, ref, kind: kindOf(c.dtype), table: t.name, column: c.name });
    });
  });
  return [...out, ...custom];
}

export const stageLabel = (n: number) => (n === 0 ? 'Data' : `Stage ${n + 1}`);
export const isSummarized = (s: QbStage) => !!(s.aggregations?.length || s.breakouts?.length);

const nameOf = (r: Ref | undefined) => (typeof r === 'object' ? r.c : String(r ?? ''));
/** Output column names of a summarized stage — mirrors the backend's default naming. */
export const summaryNames = (s: QbStage): string[] => [
  ...(s.breakouts ?? []).map((b) => b.as || nameOf(b.col) + (!b.bucket || b.bucket === 'none' ? '' : ` (${b.bucket})`)),
  ...(s.aggregations ?? []).map((a) => a.as || (a.fn === 'count' ? 'count' : `${a.fn} of ${nameOf(a.col)}`)),
];
/** Columns a stage's sort / window pickers can use as its OUTPUT. */
export function outputCols(s: StageLike, cols: ColOpt[]): ColOpt[] {
  const wins = (s.windows ?? []).map((w) => w.as || w.fn + (w.col ? ` of ${nameOf(w.col)}` : ''));
  const mk = (n: string): ColOpt => ({ key: refKey(n), label: n, ref: n, kind: 'num', column: n });
  return isSummarized(s) ? [...summaryNames(s), ...wins].map(mk) : [...cols, ...wins.map(mk)];
}
type StageLike = QbStage;
