import {
  AreaChart, BarChart3, Funnel, Gauge, LayoutGrid, Layers, LineChart, PieChart, Radar, ScatterChart, Table2, Grid3x3, ChartColumn, ChartNoAxesColumn, ChartCandlestick, Target, Workflow, Sun, Waves,
  type LucideIcon,
} from 'lucide-react';
import type { ChartType } from '@/lib/types';

export type Family = 'cartesian' | 'part' | 'radar' | 'kpi' | 'table' | 'pivot' | 'special';

/** Drawn by their own component from the raw result (no shared X/series preparation). */
const CUSTOM = new Set<string>(['histogram', 'waterfall', 'boxplot', 'gauge', 'progress', 'sankey', 'sunburst']);
export const isCustom = (t: string) => CUSTOM.has(t);

export interface ChartKind {
  id: ChartType;
  label: string;
  icon: LucideIcon;
  family: Family;
  /** What each encoding slot means for this kind. `null` hides the slot. */
  roles: { x: string; y: string; color: string | null; size?: string };
  multiMeasure: boolean;
}

const cart = (color: string | null = 'Split into series by') => ({ x: 'X axis (category / time)', y: 'Measures (Y)', color });

export const KINDS: ChartKind[] = [
  { id: 'bar', label: 'Bar', icon: BarChart3, family: 'cartesian', roles: cart(), multiMeasure: true },
  { id: 'line', label: 'Line', icon: LineChart, family: 'cartesian', roles: cart(), multiMeasure: true },
  { id: 'area', label: 'Area', icon: AreaChart, family: 'cartesian', roles: cart(), multiMeasure: true },
  { id: 'composed', label: 'Combo', icon: Layers, family: 'cartesian', roles: { ...cart(null), y: 'Measures (1st = bars, rest = lines)' }, multiMeasure: true },
  { id: 'scatter', label: 'Scatter', icon: ScatterChart, family: 'cartesian', roles: { x: 'X (number)', y: 'Y (number)', color: 'Colour by', size: 'Bubble size' }, multiMeasure: false },
  { id: 'pie', label: 'Pie / Donut', icon: PieChart, family: 'part', roles: { x: 'Slices', y: 'Value', color: null }, multiMeasure: false },
  { id: 'funnel', label: 'Funnel', icon: Funnel, family: 'part', roles: { x: 'Stages', y: 'Value', color: null }, multiMeasure: false },
  { id: 'treemap', label: 'Treemap', icon: LayoutGrid, family: 'part', roles: { x: 'Tiles', y: 'Size', color: null }, multiMeasure: false },
  { id: 'radar', label: 'Radar', icon: Radar, family: 'radar', roles: { x: 'Axes (categories)', y: 'Measures', color: null }, multiMeasure: true },
  { id: 'kpi', label: 'KPI', icon: Gauge, family: 'kpi', roles: { x: 'Trend axis (optional)', y: 'Value', color: null }, multiMeasure: false },
  { id: 'histogram', label: 'Histogram', icon: ChartColumn, family: 'cartesian', roles: { x: 'Not used', y: 'Number to bucket', color: null }, multiMeasure: false },
  { id: 'waterfall', label: 'Waterfall', icon: ChartNoAxesColumn, family: 'cartesian', roles: { x: 'Steps', y: 'Change (+ / −)', color: null }, multiMeasure: false },
  { id: 'boxplot', label: 'Box plot', icon: ChartCandlestick, family: 'cartesian', roles: { x: 'Group by (optional)', y: 'Number', color: null }, multiMeasure: false },
  { id: 'gauge', label: 'Gauge', icon: Target, family: 'special', roles: { x: 'Not used', y: 'Value', color: null }, multiMeasure: false },
  { id: 'progress', label: 'Progress', icon: Waves, family: 'special', roles: { x: 'Not used', y: 'Value', color: null }, multiMeasure: false },
  { id: 'sankey', label: 'Sankey', icon: Workflow, family: 'special', roles: { x: 'Source', y: 'Count', color: 'Target' }, multiMeasure: false },
  { id: 'sunburst', label: 'Sunburst', icon: Sun, family: 'special', roles: { x: 'Inner ring', y: 'Value', color: 'Outer ring' }, multiMeasure: false },
  { id: 'table', label: 'Table', icon: Table2, family: 'table', roles: { x: '', y: '', color: null }, multiMeasure: false },
  { id: 'pivot', label: 'Pivot table', icon: Grid3x3, family: 'pivot', roles: { x: 'Rows', y: 'Values', color: 'Columns' }, multiMeasure: false },
];

export const kindOf = (t: ChartType): ChartKind => KINDS.find((k) => k.id === t) ?? KINDS[0];
