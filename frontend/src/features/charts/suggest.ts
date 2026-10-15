/**
 * Chart suggestions from a query's result (pure, no imports, so node tests can load it): look at the columns (numbers, dates,
 * text), the row count and how many distinct items there are, then rank the chart types that fit, each with a plain reason.
 */

type Row = Record<string, unknown>;
export interface Suggestion {
  type: string;
  title: string;
  reason: string;
  score: number;
  options: Record<string, unknown>;
  /** Encoding tweaks on top of the automatic mapping (e.g. split a bar by the 2nd text column). */
  encoding?: Record<string, unknown>;
}
export interface Profile { numbers: string[]; dates: string[]; texts: string[]; rows: number; distinct: number }

const DATE_VALUE = /^\d{4}-\d{2}(-\d{2})?([T ]|$)/;
const DATE_NAME = /(date|day|month|week|year|period|time)/i;

export function profile(columns: string[], rows: Row[]): Profile {
  const sample = rows.slice(0, 50);
  const numbers: string[] = [], dates: string[] = [], texts: string[] = [];
  for (const c of columns) {
    const vals = sample.map((r) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
    if (vals.length && vals.every((v) => DATE_VALUE.test(String(v)))) dates.push(c);
    else if (vals.length && vals.every((v) => typeof v === 'number' || !Number.isNaN(Number(v)))) (DATE_NAME.test(c) && /year/i.test(c) ? dates : numbers).push(c);
    else texts.push(c);
  }
  const first = texts[0];
  const distinct = first ? new Set(rows.map((r) => String(r[first] ?? ''))).size : rows.length;
  return { numbers, dates, texts, rows: rows.length, distinct };
}

/** Ranked suggestions (best first), excluding the chart type already in use. */
export function suggestCharts(columns: string[], rows: Row[], current = '', max = 6): Suggestion[] {
  const p = profile(columns, rows);
  const n = p.numbers.length, t = p.texts.length, d = p.dates.length;
  const out: Suggestion[] = [];
  const add = (type: string, title: string, reason: string, score: number, options: Record<string, unknown> = {}, encoding?: Record<string, unknown>) =>
    out.push({ type, title, reason, score, options, encoding });
  const items = `${p.distinct} item${p.distinct === 1 ? '' : 's'}`;

  if (p.rows === 1 && n >= 1) {
    add('kpi', 'Big number', 'One row with a number: a headline figure.', 95, { numberFormat: 'compact', kpiAlign: 'left' });
    add('gauge', 'Gauge', 'One value shown against Low / Medium / High ranges.', 55);
    if (n >= 2) add('progress', 'Progress to goal', 'Two numbers in one row: the first as progress toward the second.', 60, { goalColumn: p.numbers[1] });
  }
  if (d >= 1 && n >= 1 && p.rows > 1) {
    add('line', 'Trend line', `Numbers over ${p.dates[0]}: how they change over time.`, 90, { curve: 'monotone' });
    add('area', 'Area trend', 'The same trend with the volume filled in.', 72);
    if (n >= 2) add('composed', 'Bars + line', `${p.numbers[0]} as bars and ${p.numbers[1]} as a line on one time axis.`, 84);
    add('bar', 'Columns over time', 'Each period as a column: easy to compare period by period.', 62);
    if (t >= 1) add('timebreak', 'Time breakdown', `${p.texts[0]} by year, opening into months.`, 74);
  }
  if (t >= 1 && n >= 1 && p.rows > 1) {
    add('bar', 'Ranked bars', `1 category + 1 number, ${items}: biggest first, easy to compare.`, d ? 60 : t >= 2 ? 66 : 92,
      { horizontal: true, sortBy: 'value', sortDir: 'desc', showDataLabels: true, dataLabels: 'all', showLegend: false });
    if (p.distinct <= 8) add('pie', 'Donut', `Share of the total across ${items}.`, 80, { donut: true, pieLabels: 'percent' });
    add('treemap', 'Treemap', `Area = size: shows which of the ${items} dominate.`, p.distinct > 8 ? 78 : 66, { showDataLabels: true });
    if (p.distinct <= 8 && !d) add('funnel', 'Funnel', 'Stages from largest to smallest.', 38, { showDataLabels: true });
    if (n >= 2) {
      add('ranked', 'Top N vs previous', `${p.numbers[0]} with ${p.numbers[1]} as the previous value: rank, bar and growth %.`, 86, { limit: 10 });
      add('quadrant', 'Performance groups', 'Stars / Rising / Watch / Laggards from share and growth.', 70);
      add('composed', 'Grouped comparison', `${p.numbers.slice(0, 2).join(' and ')} side by side per item.`, 64);
      if (n <= 3) add('reconcile', 'Reconcile values', 'Do the numbers agree per item? Match rate and differences.', 40);
    }
  }
  if (t >= 2 && n >= 1) {
    add('pivot', 'Pivot table', `${p.texts[0]} × ${p.texts[1]} with totals.`, 82, { pivotRowTotals: true, pivotColTotals: true });
    add('bar', 'Stacked bars', `${p.texts[0]} split by ${p.texts[1]}.`, 68, { stacked: true }, { color: p.texts[1] });
    add('sunburst', 'Sunburst', `${p.texts[0]} → ${p.texts[1]} as two rings.`, 58, { showDataLabels: true }, { color: p.texts[1] });
    add('sankey', 'Flow', `Flow from ${p.texts[0]} to ${p.texts[1]}.`, 52, {}, { color: p.texts[1] });
  }
  if (n >= 2 && t === 0 && d === 0 && p.rows > 2) add('scatter', 'Scatter', `${p.numbers[0]} against ${p.numbers[1]}: is there a relationship?`, 82, { trendline: true });
  if (n === 1 && t === 0 && d === 0 && p.rows > 5) add('histogram', 'Histogram', `How ${p.numbers[0]} values are spread.`, 70);
  if (p.rows > 1) add('table', 'Table', 'Every row and column, sortable and filterable.', 30);

  // best first; one card per type+title, skip what is already shown
  const seen = new Set<string>();
  return out.sort((a, b) => b.score - a.score)
    .filter((s) => { const k = `${s.type}|${s.title}`; if (s.type === current || seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}
