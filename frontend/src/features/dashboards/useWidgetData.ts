import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRefreshTick } from './dashboardRefresh';
import type { Chart, QueryResult } from '@/lib/types';

export function useWidgetData(chartId: string | null | undefined) {
  const [chart, setChart] = useState<Chart | null>(null);
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = useRefreshTick();

  useEffect(() => {
    if (!chartId) return;
    api.get<Chart>(`/charts/${chartId}`).then(setChart).catch((e) => setError(e.message));
  }, [chartId]);
  useEffect(() => {   // data re-runs on every dashboard refresh
    if (!chartId) return;
    api.get<QueryResult>(`/charts/${chartId}/data`).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, [chartId, tick]);

  return { chart, data, error };
}
