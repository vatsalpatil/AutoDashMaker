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
