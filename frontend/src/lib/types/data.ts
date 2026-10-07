/** Datasets, sources, query results, relationships and transforms. Re-exported from lib/types (index.ts). */

export interface Source {
  id: string;
  name: string;
  type: 'file' | 'postgres' | 'rest' | string;
  config?: Record<string, unknown>;
  status?: string;
  created_at?: string;
}

export interface DatasetColumn {
  name: string;
  dtype?: string;
  type?: string;
}

export interface Dataset {
  id: string;
  name: string;
  kind?: string;
  physical_name?: string;
  row_count?: number;
  column_count?: number;
  columns?: DatasetColumn[];
  source_id?: string | null;
  /** set for linked (live) datasets: only the schema was imported, queries run against this remote table */
  remote_table?: string | null;
  created_at?: string;
}

export interface SchemaColumn {
  name: string;
  dtype: string;
  null_pct: number;
  distinct_count: number;
  sample_values: unknown[];
}

export interface DatasetSchema {
  table: string;
  row_count: number;
  columns: SchemaColumn[];
}

export interface QueryResult {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  duration_ms: number;
  warnings: string[];
  query_id?: string;
  cached?: boolean;
}

export interface PreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  duration_ms: number;
  warnings: string[];
  sql: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  dataset_id?: string | null;
  row_count?: number | null;
  duration_ms?: number | null;
  created_at?: string;
}

export interface FreshnessStatus {
  last_updated: string;
  age_minutes: number;
  expected_interval_minutes: number | null;
  auto_refresh?: boolean;
  last_refresh_error?: string | null;
  status: 'fresh' | 'stale' | 'unconfigured';
}

export interface SourceHealthItem {
  id: string;
  name: string;
  type: string;
  connection: { ok: boolean; detail?: string; latency_ms?: number } | null;
  dataset_count: number;
  auto_refresh_datasets: number;
  last_refresh_error?: string | null;
}

export interface TransformPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  preview_of?: string;
}

export type TransformLayer = { type: 'sql'; sql: string } | { type: 'python'; code: string };

export interface DeriveRequest {
  name: string;
  base_dataset_id: string;
  layers: TransformLayer[];
}

export interface BlendRequest {
  name: string;
  left_dataset_id: string;
  right_dataset_id: string;
  left_column: string;
  right_column: string;
  join_type: 'left' | 'inner' | 'full';
}

export interface Relationship {
  id: string;
  left_dataset_id: string;
  left_dataset?: string;
  left_column: string;
  right_dataset_id: string;
  right_dataset?: string;
  right_column: string;
  join_type: 'left' | 'inner' | 'full';
  source?: string;
}

export interface RelationshipSuggestion {
  left_dataset_id: string;
  left_dataset: string;
  left_column: string;
  right_dataset_id: string;
  right_dataset: string;
  right_column: string;
  dtype: string;
}

export interface Snippet {
  name: string;
  kind: 'python' | string;
  description: string;
  code: string;
}
