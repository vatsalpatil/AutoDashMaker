/** AI providers/models, ask & SQL-assistant responses, explanations, why-analysis. Re-exported from lib/types (index.ts). */
import type { QueryResult } from './data';
import type { ChartSpec } from './viz';

export interface AiCatalogEntry {
  id: string;
  label: string;
  free: boolean;
  note?: string;
  models?: string[];
}

export interface AiModel {
  id: string;
  name: string;
  free: boolean;
  context?: number | null;
  price_in?: number | null;   // USD per 1M tokens
  price_out?: number | null;
}

export interface AiModelList {
  models: AiModel[];
  source: 'live' | 'fallback';
  error?: string;
}

export interface AiProviderStats {
  ok: boolean;
  detail?: string | null;
  latency_ms: number;
  model_count: number;
  free_count: number;
  models_source: 'live' | 'fallback';
  models_error?: string | null;
  active_model?: string | null;
}

export interface AiProvider {
  id: string;
  provider: string;
  label: string;
  model?: string;
  base_url?: string;
  is_default?: boolean;
  created_at?: string;
}

export interface SqlGenResponse {
  status: 'ok' | 'no_provider' | 'not_a_query';
  sql?: string;
  explanation?: Partial<QueryExplanation>;
  detail?: string;
}

export interface AskResponse {
  status: 'ok' | 'no_provider' | 'sql_error' | 'not_a_query';
  sql?: string;
  result?: QueryResult;
  explanation?: QueryExplanation;
  insights?: Insight[];
  confidence?: 'verified' | 'likely_correct' | 'needs_clarification' | 'data_quality_concern' | 'insufficient_data';
  conversation_id?: string;
  provenance?: {
    dataset: string;
    rows: number;
    duration_ms: number;
    warnings: string[];
  };
  detail?: string;
}

/** One analyst turn from POST /ai/chat. */
export interface AnalystResponse {
  status: 'ok' | 'clarify' | 'no_provider' | 'sql_error' | 'not_a_query';
  detail?: string;
  sql?: string;
  result?: QueryResult;
  summary?: string;
  followups?: string[];
  chart?: ChartSpec;
  explanation?: QueryExplanation;
  insights?: Insight[];
  confidence?: AskResponse['confidence'];
  provenance?: { tables: string[]; rows: number; duration_ms: number; warnings: string[] };
}

export interface QueryExplanation {
  tables: string[];
  columns: string[];
  filters: string[];
  grouped_by: string[];
  calculated: string[];
  joins: string[];
  sorted_by: string[];
  limit?: string | null;
  read_only: boolean;
}

export interface Insight {
  kind: 'trend' | 'anomaly' | 'contribution';
  text: string;
}

export interface WhyContributor {
  value: string;
  current: number;
  previous: number;
  delta: number;
  share_pct: number;
}

export interface WhyBreakdown {
  dimension: string;
  contributors: WhyContributor[];
}

export interface WhyResponse {
  metric: string;
  period: { current: string; previous: string };
  current: number;
  previous: number;
  delta: number;
  delta_pct: number;
  direction: 'up' | 'down' | 'flat';
  headline?: string | null;
  breakdowns: WhyBreakdown[];
  caveat?: string | null;
}
