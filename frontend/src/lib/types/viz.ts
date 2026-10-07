/** Charts, dashboards, widgets and generated dashboards. Re-exported from lib/types (index.ts). */
import type { Dataset, SavedQuery, Source } from './data';
import type { QualityRun } from './governance';

export type ChartType =
  | 'bar' | 'line' | 'area' | 'composed' | 'scatter' | 'pie' | 'radar' | 'funnel' | 'treemap'
  | 'kpi' | 'table' | 'pivot'
  | 'histogram' | 'waterfall' | 'boxplot' | 'gauge' | 'progress' | 'sankey' | 'sunburst';

/** Which columns feed the chart. `y` is the first measure (kept for older charts); `ys` lists all measures. */
export interface ChartEncoding {
  x: string;
  y: string;
  ys?: string[];
  color?: string;   // split into series (cartesian) / pivot columns
  size?: string;    // scatter: bubble size
}

export interface ChartSpec {
  type: ChartType;
  encoding: ChartEncoding;
  options?: Record<string, unknown>;
}

export interface Chart {
  id: string;
  name: string;
  spec: ChartSpec;
  query_id?: string;
  created_at?: string;
}

export interface ChartLineage {
  chart: Chart;
  query?: SavedQuery | null;
  dataset?: Dataset | null;
  source?: Source | null;
  data_quality?: QualityRun | null;
}

export interface DashboardPage {
  id: string;
  name: string;
}

export interface Widget {
  id: string;
  chart_id: string;   // empty for text / link / embed cards
  kind?: 'chart' | 'section' | 'text' | 'link' | 'iframe';
  title?: string;
  position: { x: number; y: number; w: number; h: number };
  page?: string;
  settings?: Record<string, unknown>;
}

export interface DashboardWidget extends Widget {}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets?: Widget[];
  pages?: DashboardPage[];
  created_at?: string;
}

export interface GenerateResponse {
  dashboard_id: string;
  name: string;
  widgets: { chart: Chart; why?: string | null }[];
}

export interface BriefResponse {
  dashboard: string;
  findings: string[];
  attention: string[];
  widgets: { chart: Chart; why?: string | null }[];
  generated_from?: string;
}
