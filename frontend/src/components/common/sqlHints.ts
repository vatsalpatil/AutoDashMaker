import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { SQLNamespace } from '@codemirror/lang-sql';

/** Smart SQL hints while typing: DuckDB functions (with signature), every column of every table, and common snippets. */

const FN: [string, string][] = [
  ['count', 'count(*) · rows'], ['sum', 'sum(x)'], ['avg', 'avg(x)'], ['min', 'min(x)'], ['max', 'max(x)'], ['median', 'median(x)'],
  ['count_distinct', 'count(DISTINCT x)'], ['stddev', 'stddev(x)'], ['quantile_cont', 'quantile_cont(x, 0.9)'], ['mode', 'mode(x)'],
  ['string_agg', 'string_agg(x, \', \')'], ['list', 'list(x) · array'], ['arg_max', 'arg_max(val, by)'], ['arg_min', 'arg_min(val, by)'],
  ['round', 'round(x, digits)'], ['abs', 'abs(x)'], ['ceil', 'ceil(x)'], ['floor', 'floor(x)'], ['coalesce', 'coalesce(a, b, …)'],
  ['nullif', 'nullif(a, b)'], ['greatest', 'greatest(a, b)'], ['least', 'least(a, b)'], ['cast', 'CAST(x AS type)'], ['try_cast', 'TRY_CAST(x AS type)'],
  ['lower', 'lower(s)'], ['upper', 'upper(s)'], ['trim', 'trim(s)'], ['length', 'length(s)'], ['concat', 'concat(a, b)'],
  ['replace', 'replace(s, from, to)'], ['substring', 'substring(s, start, len)'], ['split_part', 'split_part(s, sep, n)'],
  ['regexp_matches', 'regexp_matches(s, pattern)'], ['regexp_extract', 'regexp_extract(s, pattern)'], ['contains', 'contains(s, part)'],
  ['strftime', "strftime(date, '%Y-%m')"], ['strptime', "strptime(s, '%d/%m/%Y')"], ['date_trunc', "date_trunc('month', d)"],
  ['date_part', "date_part('year', d)"], ['date_diff', "date_diff('day', a, b)"], ['current_date', 'current_date'], ['now', 'now()'],
  ['year', 'year(d)'], ['month', 'month(d)'], ['day', 'day(d)'], ['dayname', 'dayname(d)'], ['monthname', 'monthname(d)'],
  ['row_number', 'row_number() OVER (…)'], ['rank', 'rank() OVER (…)'], ['dense_rank', 'dense_rank() OVER (…)'],
  ['lag', 'lag(x) OVER (ORDER BY …)'], ['lead', 'lead(x) OVER (ORDER BY …)'], ['ntile', 'ntile(4) OVER (…)'],
];

const SNIPPETS: Completion[] = [
  { label: 'SELECT * FROM', type: 'keyword', detail: 'snippet', apply: 'SELECT *\nFROM ' },
  { label: 'GROUP BY ALL', type: 'keyword', detail: 'DuckDB: group by every non-aggregate' },
  { label: 'ORDER BY … DESC LIMIT 10', type: 'keyword', detail: 'top 10', apply: 'ORDER BY  DESC\nLIMIT 10' },
  { label: 'CASE WHEN', type: 'keyword', detail: 'snippet', apply: 'CASE WHEN  THEN  ELSE  END' },
  { label: 'OVER (PARTITION BY', type: 'keyword', detail: 'window', apply: 'OVER (PARTITION BY  ORDER BY )' },
];

const fnOptions: Completion[] = FN.map(([label, detail]) => ({
  label, detail, type: 'function', boost: -1,
  apply: /\(|·/.test(detail) && !/^(current_date)$/.test(label) ? `${label}()` : label,
}));

/** Completion source: functions + unqualified column names (lang-sql only offers columns after `table.`). */
export function sqlHints(schema?: SQLNamespace) {
  const cols = new Map<string, string[]>();
  for (const [table, c] of Object.entries((schema ?? {}) as Record<string, unknown>)) {
    if (Array.isArray(c)) for (const col of c) { const n = typeof col === 'string' ? col : (col as Completion).label; cols.set(n, [...(cols.get(n) ?? []), table]); }
  }
  const colOptions: Completion[] = [...cols].map(([label, tables]) => ({
    label, type: 'property', detail: tables.length > 2 ? `${tables.slice(0, 2).join(', ')} +${tables.length - 2}` : tables.join(', '),
    apply: /^[A-Za-z_][A-Za-z0-9_]*$/.test(label) ? label : `"${label}"`,
  }));
  const options = [...colOptions, ...fnOptions, ...SNIPPETS];
  return (ctx: CompletionContext): CompletionResult | null => {
    const word = ctx.matchBefore(/[\w$]+/);
    if (ctx.matchBefore(/[\w$]*\.[\w$]*$/)) return null;     // after `table.` lang-sql's own columns win
    if (!word && !ctx.explicit) return null;
    if (word && word.text.length < 1) return null;
    return { from: word ? word.from : ctx.pos, options, validFor: /^[\w$]*$/ };
  };
}
