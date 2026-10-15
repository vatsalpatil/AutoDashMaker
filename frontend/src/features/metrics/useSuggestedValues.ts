import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { MetricSuggestion, MetricValue } from '@/lib/types';

export const suggestionKey = (s: MetricSuggestion) => `${s.dataset_id}:${s.name}`;

/** Live value + trend for each suggested number (same calculation the saved metrics use), so the board is useful before anything is pinned. */
export function useSuggestedValues(items: MetricSuggestion[]) {
  const [values, setValues] = useState<Record<string, MetricValue>>({});
  const sig = items.map(suggestionKey).join('|');
  useEffect(() => {
    let alive = true;
    for (const s of items) {
      api.post<MetricValue>('/semantic/metrics/preview', { dataset_id: s.dataset_id, expression: s.expression, filters: [] })
        .then((v) => { if (alive) setValues((cur) => ({ ...cur, [suggestionKey(s)]: v })); })
        .catch((e: Error) => { if (alive) setValues((cur) => ({ ...cur, [suggestionKey(s)]: { value: null, sql: null, trend: [], ms: 0, error: e.message } })); });
    }
    return () => { alive = false; };
  }, [sig]);  // eslint-disable-line react-hooks/exhaustive-deps
  return values;
}
