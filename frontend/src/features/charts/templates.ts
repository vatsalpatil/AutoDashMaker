import type { ChartEncoding, ChartType, QueryResult } from '@/lib/types';
import { columnKinds } from './chartData';
import { kindOf } from './chartKinds';
import type { Opts } from './format';

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  group: string;
  type: ChartType;
  options: Opts;
}

const t = (group: string, id: string, name: string, type: ChartType, description: string, options: Opts = {}): ChartTemplate =>
  ({ group, id, name, type, description, options });

export const TEMPLATES: ChartTemplate[] = [
  t('Compare', 'ranked-bars', 'Ranked bars', 'bar', 'Top 10 categories, biggest first, with value labels.', { horizontal: true, sortBy: 'value', sortDir: 'desc', limit: 10, showDataLabels: true, showLegend: false, grid: 'none', barRadius: 6 }),
  t('Compare', 'columns', 'Columns', 'bar', 'Classic vertical columns for a few categories.', { barRadius: 6, showLegend: false }),
  t('Compare', 'grouped', 'Grouped columns', 'bar', 'Compare series side by side (set “Split into series by”).', { barRadius: 4 }),
  t('Compare', 'stacked', 'Stacked columns', 'bar', 'Parts of each category stacked into a total.', { stacked: true, barRadius: 0 }),
  t('Compare', 'stacked-100', '100% stacked', 'bar', 'Share of each series inside every category.', { stacked: true, percentStack: true, numberFormat: 'percent', barRadius: 0 }),
  t('Trend', 'smooth-line', 'Smooth line', 'line', 'Clean time-series line.', { curve: 'monotone', showLegend: false, grid: 'horizontal' }),
  t('Trend', 'area-gradient', 'Gradient area', 'area', 'Soft filled area under the trend.', { gradient: true, curve: 'monotone', showLegend: false }),
  t('Trend', 'stepped', 'Stepped line', 'line', 'For values that hold between changes (prices, status).', { curve: 'step', dots: true }),
  t('Trend', 'running-total', 'Running total', 'area', 'Cumulative sum over the axis.', { cumulative: true, curve: 'monotone', showLegend: false }),
  t('Trend', 'trend-line', 'Line + trend', 'line', 'Raw line with a fitted trend overlay.', { trendline: true, dots: true, showLegend: false }),
  t('Trend', 'combo', 'Combo: bars + line', 'composed', 'First measure as bars, next as a line on its own axis.', { dualAxis: true, barRadius: 4 }),
  t('Share', 'donut', 'Donut', 'pie', 'Share of total with percentage labels.', { donut: true, pieLabels: 'percent', padAngle: 2 }),
  t('Share', 'pie', 'Pie', 'pie', 'Classic pie for up to ~6 slices.', { pieLabels: 'name' }),
  t('Share', 'funnel', 'Funnel', 'funnel', 'Stages from widest to narrowest.', { showDataLabels: true }),
  t('Share', 'treemap', 'Treemap', 'treemap', 'Area proportional to value.', { showDataLabels: true }),
  t('Relate', 'scatter-trend', 'Scatter + trend', 'scatter', 'Two numbers against each other with a fit line.', { trendline: true, dotSize: 8 }),
  t('Relate', 'bubble', 'Bubble', 'scatter', 'Add a third number as bubble size.', { dotSize: 10, dotOpacity: 0.6 }),
  t('Relate', 'radar', 'Radar', 'radar', 'Profile of several measures across categories.', { fillOpacity: 0.25, dots: true }),
  t('Distribution', 'histogram', 'Histogram', 'histogram', 'How often values fall in each bucket.', { barRadius: 2 }),
  t('Distribution', 'boxplot', 'Box plot', 'boxplot', 'Median, quartiles, outliers per group.', { whisker: 'iqr', boxPoints: 'outliers', showMean: true }),
  t('Flow', 'waterfall', 'Waterfall', 'waterfall', 'Running total moved up and down by each step.', { showTotal: true, showDataLabels: true }),
  t('Flow', 'sankey', 'Sankey', 'sankey', 'Flow from a source to a target (needs source, target and count).', { edgeColor: 'source' }),
  t('Share', 'sunburst', 'Sunburst', 'sunburst', 'Two rings: a category and its sub-categories.', { pieLabels: 'name' }),
  t('KPI', 'gauge', 'Gauge', 'gauge', 'A value against coloured Low / Medium / High ranges.', { gaugeRanges: '0-33 Low; 33-66 Medium; 66-100 High' }),
  t('KPI', 'progress', 'Progress bar', 'progress', 'How far a value is toward its goal.', { goalValue: 100 }),
  t('KPI', 'kpi-big', 'Big number', 'kpi', 'One headline figure.', { numberFormat: 'compact', valueFontSize: 56 }),
  t('KPI', 'kpi-trend', 'KPI + change', 'kpi', 'Headline with change vs previous row and a sparkline.', { numberFormat: 'compact', showDelta: true, showSparkline: true, kpiAlign: 'left' }),
  t('Tables', 'table', 'Data table', 'table', 'Every column of the query.', { tableDensity: 'compact' }),
  t('Tables', 'table-striped', 'Striped table', 'table', 'Zebra rows, comfortable spacing.', { tableStriped: true, tableDensity: 'comfortable' }),
  t('Tables', 'pivot', 'Pivot table', 'pivot', 'Rows × columns cross-tab with totals.', { pivotAgg: 'sum', pivotRowTotals: true, pivotColTotals: true }),
  t('Tables', 'pivot-heat', 'Pivot heatmap', 'pivot', 'Cross-tab shaded by value.', { pivotHeatmap: true, pivotRowTotals: false, pivotColTotals: false }),
];

/** Sensible first guess of which columns feed a chart of this type: text → category, numbers → measures. */
export function autoEncode(type: ChartType, result: QueryResult | null, current?: ChartEncoding): ChartEncoding {
  if (!result) return current ?? { x: '', y: '' };
  const { numeric, other } = columnKinds(result);
  const all = result.columns;
  const kind = kindOf(type);
  if (type === 'scatter') {
    const [a, b, c] = numeric;
    return { x: a ?? all[0] ?? '', y: b ?? all[1] ?? a ?? '', color: other[0], size: c };
  }
  const x = other[0] ?? all[0] ?? '';
  const ys = numeric.filter((c) => c !== x);
  const y = ys[0] ?? all.find((c) => c !== x) ?? x;
  const enc: ChartEncoding = { x, y };
  if (kind.multiMeasure && ys.length > 1 && (type === 'composed' || type === 'radar')) enc.ys = ys.slice(0, 2);
  if (type === 'histogram' || type === 'boxplot') { enc.y = numeric[0] ?? enc.y; if (type === 'histogram') enc.x = ''; }
  if (type === 'gauge' || type === 'progress') { enc.y = numeric[0] ?? enc.y; enc.x = ''; }
  if (type === 'sankey' || type === 'sunburst') enc.color = other[1] ?? all.find((c) => c !== x && c !== y);
  if (type === 'pivot') enc.color = other[1] ?? all.find((c) => c !== x && c !== y);
  return enc;
}
