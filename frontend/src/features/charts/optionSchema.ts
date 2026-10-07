import type { ChartType } from '@/lib/types';
import { PALETTES } from './palettes';
import { kindOf, type Family } from './chartKinds';
import type { Opts } from './format';
import { BAR_STYLES } from './render/Bar3D';
import { FILL_STYLES } from './render/fills';

/**
 * Every chart option, declared once. The options panel renders whatever applies to the chosen chart type,
 * so adding an option is one line here plus one read in the renderer.
 */
export type FieldKind = 'switch' | 'select' | 'number' | 'slider' | 'color' | 'text';
type Scope = ChartType | Family;

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Show only for these chart types / families (omitted = every chart). */
  for?: Scope[];
  /** Show only while this holds for the current options. */
  when?: (o: Opts) => boolean;
}

export interface Section { id: string; label: string; fields: Field[] }
export interface Tab { id: string; label: string; sections: Section[] }

const CART: Scope[] = ['cartesian'];
const VISUAL: Scope[] = ['cartesian', 'part', 'radar'];
const sw = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'switch', ...f });
const sel = (key: string, label: string, options: [string, string][], f: Partial<Field> = {}): Field => ({ key, label, kind: 'select', options, ...f });
const sld = (key: string, label: string, min: number, max: number, step = 1, f: Partial<Field> = {}): Field => ({ key, label, kind: 'slider', min, max, step, ...f });
const txt = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'text', ...f });
const numf = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'number', ...f });
const col = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'color', ...f });

const NUMBER_FORMATS: [string, string][] = [['auto', 'Auto'], ['compact', 'Compact (1.2K)'], ['decimal', 'Decimal (1,234.5)'], ['currency', 'Currency'], ['percent', 'Percent']];

export const TABS: Tab[] = [
  {
    id: 'style', label: 'Style', sections: [
      { id: 'look', label: 'Look', fields: [
        sel('palette', 'Colour palette', PALETTES.map((p) => [p.id, p.label]), { for: [...VISUAL] }),
        col('seriesColor', 'Override first series colour', { for: ['cartesian', 'radar'] }),
        sel('background', 'Panel background', [['none', 'None'], ['card', 'Card'], ['muted', 'Muted'], ['gradient', 'Accent gradient']]),
        sw('showLegend', 'Legend', { for: ['cartesian', 'part', 'radar'] }),
        sel('legendPosition', 'Legend position', [['bottom', 'Bottom'], ['top', 'Top']], { for: VISUAL, when: (o) => o.showLegend !== false }),
        sw('showTooltip', 'Tooltip on hover', { for: VISUAL }),
        sel('tooltipIndicator', 'Tooltip marker', [['dot', 'Dot'], ['line', 'Line'], ['dashed', 'Dashed line']], { for: VISUAL, when: (o) => o.showTooltip !== false }),
        sw('tooltipCursor', 'Hover guide line / highlight', { for: ['bar', 'line', 'area', 'composed', 'scatter'], when: (o) => o.showTooltip !== false }),
        sw('animate', 'Animation', { for: VISUAL }),
        sw('glow', 'Glow effect', { for: ['line', 'area', 'composed', 'radar', 'scatter'] }),
        sw('rangeSelect', 'Range selector (last 7 / 30 / 90 points)', { for: ['bar', 'line', 'area', 'composed'] }),
        sw('trendBadge', 'Trend badge (change vs previous point)', { for: ['bar', 'line', 'area', 'composed'] }),
      ] },
      { id: 'fill', label: 'Fill', fields: [
        sel('fillStyle', 'Fill style', FILL_STYLES, { for: ['bar', 'area', 'composed', 'pie', 'radar'] }),
      ] },
      { id: 'bars', label: 'Bars', fields: [
        sw('horizontal', 'Horizontal bars', { for: ['bar'] }),
        sw('stacked', 'Stacked', { for: ['bar', 'area'] }),
        sw('barBackground', 'Track behind bars', { for: ['bar'] }),
        sel('barStyle', 'Bar style (3D)', BAR_STYLES, { for: ['bar', 'composed'], when: (o) => o.horizontal !== true && o.stacked !== true }),
        sw('percentStack', '100% stacked', { for: ['bar', 'area'], when: (o) => o.stacked === true }),
        sld('barRadius', 'Corner radius', 0, 16, 1, { for: ['bar', 'composed'] }),
        sld('barSize', 'Bar thickness (0 = auto)', 0, 80, 2, { for: ['bar', 'composed'] }),
      ] },
      { id: 'lines', label: 'Lines & areas', fields: [
        sel('curve', 'Line style', [['monotone', 'Smooth'], ['natural', 'Natural'], ['basis', 'Rounded (basis)'], ['bump', 'Bump'], ['linear', 'Straight'], ['step', 'Stepped'], ['stepBefore', 'Step before'], ['stepAfter', 'Step after']], { for: ['line', 'area', 'composed'] }),
        sld('lineWidth', 'Line width', 1, 6, 0.5, { for: ['line', 'area', 'composed', 'radar'] }),
        sw('dots', 'Show points', { for: ['line', 'area', 'composed', 'radar'] }),
        numf('forecastPoints', 'Forecast: last N points / N to add (0 = off)', { for: ['line', 'area', 'composed'], placeholder: '0' }),
        sel('forecastMode', 'Forecast mode', [['tail', 'Mark the last points as forecast'], ['project', 'Project the trend forward']], { for: ['line', 'area', 'composed'], when: (o) => Number(o.forecastPoints) > 0 }),
        sw('forecastShade', 'Shade the forecast zone', { for: ['line', 'area', 'composed'], when: (o) => Number(o.forecastPoints) > 0 }),
        sel('dotStyle', 'Point style', [['solid', 'Solid'], ['ring', 'Ring']], { for: ['line', 'area', 'composed'], when: (o) => o.dots === true }),
        sld('fillOpacity', 'Fill opacity', 0.05, 1, 0.05, { for: ['area', 'radar'] }),
      ] },
      { id: 'radar', label: 'Radar', fields: [
        sel('radarGrid', 'Grid shape', [['polygon', 'Polygon'], ['circle', 'Circle'], ['none', 'None']], { for: ['radar'] }),
      ] },
      { id: 'scatter', label: 'Points', fields: [
        sld('dotSize', 'Point size', 3, 30, 1, { for: ['scatter'] }),
        sld('dotOpacity', 'Point opacity', 0.1, 1, 0.05, { for: ['scatter'] }),
      ] },
      { id: 'waterfall', label: 'Waterfall', fields: [
        col('increaseColor', 'Increase colour', { for: ['waterfall'] }),
        col('decreaseColor', 'Decrease colour', { for: ['waterfall'] }),
        col('totalColor', 'Total colour', { for: ['waterfall'] }),
        sw('showTotal', 'Show total bar', { for: ['waterfall'] }),
        sld('barRadius', 'Corner radius', 0, 16, 1, { for: ['waterfall', 'histogram'] }),
      ] },
      { id: 'histogram', label: 'Histogram', fields: [
        numf('binCount', 'Number of buckets (blank = automatic)', { for: ['histogram'], placeholder: 'auto' }),
      ] },
      { id: 'boxplot', label: 'Box plot', fields: [
        sel('whisker', 'Whiskers', [['iqr', '1.5 × interquartile range'], ['minmax', 'Min / max']], { for: ['boxplot'] }),
        sel('boxPoints', 'Show points', [['outliers', 'Outliers only'], ['none', 'None'], ['all', 'All points']], { for: ['boxplot'] }),
        sw('showMean', 'Mean marker (◇)', { for: ['boxplot'] }),
        sel('boxLabels', 'Value labels', [['median', 'Median only'], ['all', 'Min, Q1, median, Q3, max'], ['none', 'None']], { for: ['boxplot'] }),
      ] },
      { id: 'gauge', label: 'Gauge', fields: [
        txt('gaugeRanges', 'Ranges: from-to Label #colour; …', { for: ['gauge'], placeholder: '0-33 Low #dc2626; 33-66 Medium #f59e0b; 66-100 High #16a34a' }),
      ] },
      { id: 'progress', label: 'Progress', fields: [
        numf('goalValue', 'Goal (fixed number)', { for: ['progress'], placeholder: '100' }),
        txt('goalColumn', 'Goal from column (overrides the number)', { for: ['progress'] }),
        sw('progressPercent', 'Show as percent', { for: ['progress'] }),
        col('progressColor', 'Bar colour', { for: ['progress'] }),
        col('goalReachedColor', 'Colour when the goal is reached', { for: ['progress'] }),
      ] },
      { id: 'sankey', label: 'Sankey', fields: [
        sel('edgeColor', 'Edge colour', [['gray', 'Gray'], ['source', 'From source node'], ['target', 'From target node']], { for: ['sankey'] }),
        sel('edgeLabels', 'Value format', [['compact', 'Compact'], ['full', 'Full']], { for: ['sankey'] }),
        sld('nodePadding', 'Node spacing', 4, 40, 2, { for: ['sankey'] }),
      ] },
      { id: 'pie', label: 'Pie / donut', fields: [
        sld('minSlicePercent', 'Fold slices under this % into "Other"', 0, 20, 1, { for: ['pie'] }),
        sw('donut', 'Donut', { for: ['pie'] }),
        sld('innerRadius', 'Hole size %', 20, 85, 5, { for: ['pie'], when: (o) => o.donut === true }),
        sld('padAngle', 'Slice gap', 0, 10, 1, { for: ['pie'] }),
        sld('startAngle', 'Start angle', 0, 360, 15, { for: ['pie'] }),
        sw('semi', 'Half circle (gauge)', { for: ['pie'] }),
        sld('cornerRadius', 'Slice corner radius', 0, 20, 1, { for: ['pie'] }),
        sel('centerLabel', 'Centre label', [['none', 'None'], ['total', 'Total'], ['custom', 'Custom text']], { for: ['pie'], when: (o) => o.donut === true }),
        txt('centerText', 'Centre text', { for: ['pie'], when: (o) => o.donut === true && o.centerLabel === 'custom' }),
        sw('funnelPyramid', 'Reverse (pyramid)', { for: ['funnel'] }),
      ] },
      { id: 'kpi', label: 'KPI card', fields: [
        sld('valueFontSize', 'Value size', 20, 120, 2, { for: ['kpi'] }),
        col('valueColor', 'Value colour', { for: ['kpi'] }),
        sw('showLabel', 'Show label', { for: ['kpi'] }),
        txt('valueRules', 'Colour rules: <50:#dc2626; >=50:#16a34a', { for: ['kpi'], placeholder: '<50:#dc2626; >=80:#16a34a' }),
        sel('kpiAlign', 'Alignment', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], { for: ['kpi'] }),
        sw('showDelta', 'Change vs previous row', { for: ['kpi'] }),
        sel('deltaGood', 'Increase is…', [['up', 'Good'], ['down', 'Bad']], { for: ['kpi'], when: (o) => o.showDelta === true }),
        sw('showSparkline', 'Sparkline', { for: ['kpi'] }),
        sel('percentOf', 'Show a percentage', [['none', 'No'], ['column', 'Of another column in the result'], ['fixed', 'Of a fixed target']], { for: ['kpi'] }),
        txt('percentColumn', 'Column to divide by', { for: ['kpi'], when: (o) => o.percentOf === 'column', placeholder: 'blank = first other number column' }),
        numf('percentBase', 'Target value', { for: ['kpi'], when: (o) => o.percentOf === 'fixed', placeholder: 'e.g. 1000000' }),
        txt('percentLabel', 'Percentage label', { for: ['kpi'], when: (o) => o.percentOf === 'column' || o.percentOf === 'fixed', placeholder: 'of target' }),
        sld('percentDecimals', 'Percentage decimals', 0, 3, 1, { for: ['kpi'], when: (o) => o.percentOf === 'column' || o.percentOf === 'fixed' }),
        sw('percentMain', 'Show the percentage as the main number', { for: ['kpi'], when: (o) => o.percentOf === 'column' || o.percentOf === 'fixed' }),
      ] },
      { id: 'table', label: 'Table', fields: [
        sel('tableFontSize', 'Text size', [['xs', 'Small'], ['sm', 'Medium'], ['md', 'Large']], { for: ['table', 'pivot'] }),
        sel('tableDensity', 'Density', [['compact', 'Compact'], ['comfortable', 'Comfortable']], { for: ['table', 'pivot'] }),
        sw('tableStriped', 'Striped rows', { for: ['table', 'pivot'] }),
        sel('pivotAgg', 'Aggregate values by', [['sum', 'Sum'], ['avg', 'Average'], ['count', 'Count'], ['min', 'Min'], ['max', 'Max']], { for: ['pivot'] }),
        sw('pivotRowTotals', 'Row totals', { for: ['pivot'] }),
        sw('pivotColTotals', 'Column totals', { for: ['pivot'] }),
        sw('pivotHeatmap', 'Heatmap shading', { for: ['pivot'] }),
      ] },
    ],
  },
  {
    id: 'axes', label: 'Axes', sections: [
      { id: 'axes', label: 'Axes & grid', fields: [
        sw('showXAxis', 'X axis', { for: CART }),
        sw('showYAxis', 'Y axis', { for: CART }),
        sel('grid', 'Grid lines', [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['both', 'Both'], ['none', 'None']], { for: CART }),
        sel('axisFontSize', 'Axis text size', [['xs', 'Small'], ['sm', 'Medium'], ['md', 'Large']], { for: CART }),
        sld('xTickAngle', 'X label angle', -90, 90, 15, { for: CART }),
        txt('xLabel', 'X axis title', { for: CART }),
        txt('yLabel', 'Y axis title', { for: CART }),
      ] },
      { id: 'scale', label: 'Scale', fields: [
        numf('yMin', 'Y minimum', { for: CART, placeholder: 'auto' }),
        numf('yMax', 'Y maximum', { for: CART, placeholder: 'auto' }),
        sel('yScale', 'Y scale', [['linear', 'Linear'], ['sqrt', 'Square root'], ['log', 'Logarithmic']], { for: CART }),
        sw('unpinZero', 'Do not force the axis to start at zero', { for: CART }),
        numf('tickCount', 'Number of Y ticks (blank = auto)', { for: CART, placeholder: 'auto' }),
        sw('dualAxis', '2nd measure on right axis', { for: ['line', 'bar', 'area', 'composed'] }),
      ] },
      { id: 'ref', label: 'Reference line', fields: [
        numf('refValue', 'Value', { for: CART, placeholder: 'none' }),
        txt('refLabel', 'Label', { for: CART }),
      ] },
    ],
  },
  {
    id: 'labels', label: 'Labels', sections: [
      { id: 'text', label: 'Heading', fields: [
        txt('chartTitle', 'Chart title'),
        txt('chartSubtitle', 'Subtitle'),
      ] },
      { id: 'data-labels', label: 'Data labels', fields: [
        sel('dataLabels', 'Show values on chart', [['none', 'None'], ['some', 'Some (when not crowded)'], ['all', 'All']], { for: ['cartesian'] }),
        sw('showDataLabels', 'Show values on chart', { for: ['part', 'waterfall', 'sankey', 'sunburst'] }),
        sel('pieLabels', 'Slice labels', [['name', 'Name'], ['value', 'Value'], ['percent', 'Percent'], ['none', 'None']], { for: ['pie', 'sunburst'] }),
      ] },
      { id: 'format', label: 'Number format', fields: [
        sel('numberFormat', 'Format', NUMBER_FORMATS),
        numf('decimals', 'Decimals', { placeholder: 'auto' }),
        txt('currency', 'Currency code', { when: (o) => o.numberFormat === 'currency', placeholder: 'USD' }),
        txt('prefix', 'Prefix'),
        txt('suffix', 'Suffix'),
      ] },
    ],
  },
  {
    id: 'data', label: 'Data', sections: [
      { id: 'transform', label: 'Prepare data', fields: [
        sel('agg', 'Aggregate by X', [['none', 'None (raw rows)'], ['sum', 'Sum'], ['avg', 'Average'], ['count', 'Count'], ['min', 'Min'], ['max', 'Max']], { for: ['cartesian', 'part', 'radar'] }),
        sel('sortBy', 'Sort by', [['none', 'Query order'], ['x', 'X / category'], ['value', 'Value']], { for: ['cartesian', 'part', 'radar'] }),
        sel('sortDir', 'Direction', [['desc', 'High → low'], ['asc', 'Low → high']], { for: ['cartesian', 'part', 'radar'], when: (o) => o.sortBy === 'x' || o.sortBy === 'value' }),
        numf('limit', 'Top N (0 = all)', { for: ['cartesian', 'part', 'radar'], placeholder: '0' }),
        sel('missing', 'Replace missing values with', [['zero', 'Zero'], ['gap', 'Nothing (a gap in the line)'], ['interpolate', 'A straight line across']], { for: ['line', 'area', 'composed', 'bar'] }),
        sw('cumulative', 'Running total', { for: ['line', 'area', 'bar'] }),
        sw('trendline', 'Trend line', { for: ['line', 'area', 'bar', 'scatter'] }),
      ] },
    ],
  },
];

/** Defaults the renderers assume when an option is unset (also what the panel shows). */
export const DEFAULTS: Opts = {
  palette: 'theme', background: 'none', showLegend: true, legendPosition: 'bottom', showTooltip: true, animate: true,
  barStyle: 'flat', forecastMode: 'tail', forecastShade: true, tooltipIndicator: 'dot', tooltipCursor: true, glow: false, rangeSelect: false, trendBadge: false, dotStyle: 'solid', centerLabel: 'none', radarGrid: 'polygon',
  curve: 'monotone', lineWidth: 2, dots: false, fillOpacity: 0.3, gradient: true, barRadius: 4, dotSize: 8, dotOpacity: 0.8,
  innerRadius: 55, valueFontSize: 48, percentOf: 'none', percentDecimals: 1, showLabel: true, kpiAlign: 'center', deltaGood: 'up',
  tableFontSize: 'sm', tableDensity: 'compact', pivotAgg: 'sum', pivotRowTotals: true, pivotColTotals: true, pivotHeatmap: false,
  showXAxis: true, showYAxis: true, grid: 'horizontal', axisFontSize: 'sm', xTickAngle: 0, numberFormat: 'auto',
  agg: 'none', sortBy: 'none', sortDir: 'desc', limit: 0, pieLabels: 'name', showDataLabels: false,
};

const matches = (f: Field, type: ChartType) => !f.for || f.for.includes(type) || f.for.includes(kindOf(type).family);

/** Sections of a tab that have at least one field for this chart type, with only the applicable fields. */
export function sectionsFor(tab: Tab, type: ChartType): Section[] {
  return tab.sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => matches(f, type)) }))
    .filter((s) => s.fields.length > 0);
}

/** Older charts stored a few options under different names/types; read them as the current ones. */
export function normalizeOptions(raw: Opts | undefined): Opts {
  const o: Opts = { ...(raw ?? {}) };
  if (o.curve === undefined && o.curved === false) o.curve = 'linear';
  if (o.grid === undefined && o.showGrid === false) o.grid = 'none';
  if (typeof o.pieLabels === 'boolean') o.pieLabels = o.pieLabels ? 'name' : 'none';
  if (o.palette === 'default') o.palette = 'theme';
  if (o.fillStyle === undefined && o.gradient === false) o.fillStyle = 'solid';   // the old "Gradient fill" switch
  return o;
}

/** Options with defaults filled in, for rendering. */
export const resolveOptions = (raw: Opts | undefined): Opts => ({ ...DEFAULTS, ...normalizeOptions(raw) });
