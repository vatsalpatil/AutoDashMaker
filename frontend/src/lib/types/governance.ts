/** Semantic layer (metrics, dimensions, definitions) and data quality. Re-exported from lib/types (index.ts). */

export interface QualityRun {
  id?: number;
  dataset_id: string;
  dataset_name?: string;
  completeness?: number;
  uniqueness?: number;
  validity?: number;
  duplicate_pct?: number;
  freshness?: string | number;
  row_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface SemanticMetric {
  id: string;
  dataset_id?: string;
  name: string;
  label: string;
  expression: string;
  filters: string[];
  description: string;
}

export interface SemanticDimension {
  id: string;
  dataset_id?: string;
  name: string;
  label: string;
  column_name: string;
  description: string;
}

export interface SemanticDefinition {
  id: string;
  term: string;
  definition: string;
}

export interface SemanticSynonym {
  id: string;
  term: string;
  maps_to: string;
}

/** GET /semantic/metrics/values (one per metric id) and POST /semantic/metrics/preview. */
export interface MetricValue {
  value: number | string | null;
  sql: string | null;
  trend: { period: string; value: number | null }[];
  ms: number;
  error: string | null;
}

/** GET /semantic/suggestions: starter metrics/dimensions read off dataset columns. */
export interface MetricSuggestion { dataset_id: string; dataset_name: string; name: string; label: string; expression: string; description: string }
export interface DimensionSuggestion { dataset_id: string; dataset_name: string; name: string; label: string; column_name: string; description: string }
export interface SemanticSuggestions { metrics: MetricSuggestion[]; dimensions: DimensionSuggestion[] }
