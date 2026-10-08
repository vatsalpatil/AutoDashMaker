import { useApi } from '@/hooks/useApi';
import type { Dataset, MetricValue, Relationship, SemanticDefinition, SemanticDimension, SemanticMetric, SemanticSuggestions, SemanticSynonym } from '@/lib/types';

/** Everything the Metrics hub shows. Live values load separately so cards appear first and numbers fill in. */
export function useMetricsData() {
  const metrics = useApi<SemanticMetric[]>('/semantic/metrics');
  const values = useApi<Record<string, MetricValue>>('/semantic/metrics/values');
  const dimensions = useApi<SemanticDimension[]>('/semantic/dimensions');
  const definitions = useApi<SemanticDefinition[]>('/semantic/definitions');
  const synonyms = useApi<SemanticSynonym[]>('/semantic/synonyms');
  const suggestions = useApi<SemanticSuggestions>('/semantic/suggestions');
  const datasets = useApi<Dataset[]>('/datasets');
  const relationships = useApi<Relationship[]>('/transforms/relationships');
  const reload = () => { metrics.reload(); values.reload(); dimensions.reload(); definitions.reload(); synonyms.reload(); suggestions.reload(); };
  return {
    metrics: metrics.data ?? [], values: values.data ?? {}, valuesLoading: values.loading, dimensions: dimensions.data ?? [],
    definitions: definitions.data ?? [], synonyms: synonyms.data ?? [], suggestions: suggestions.data ?? { metrics: [], dimensions: [] },
    datasets: datasets.data ?? [], relationships: relationships.data ?? [],
    loading: metrics.loading && !metrics.data, error: metrics.error, reload,
  };
}
