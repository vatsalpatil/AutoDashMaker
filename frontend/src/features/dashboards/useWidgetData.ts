import { useContext, useEffect, useState } from 'react';
import { ensureBundle, isFresh, loadChart, peek, type Entry } from '@/lib/dataCache';
import { DashboardIdContext, useRefreshTick } from './dashboardRefresh';
import { useDashboardParams } from './params/DashboardParams';

/**
 * A widget's chart + data. Cached copies show instantly; stale ones refresh in the background; on a dashboard the first widget
 * triggers one batch request that fills every widget; the Refresh button (tick > 0) bypasses the caches.
 */
export function useWidgetData(chartId: string | null | undefined) {
  const tick = useRefreshTick();
  const dashboardId = useContext(DashboardIdContext);
  const params = useDashboardParams();
  const suffix = params.key ? `|${params.key}` : '';   // results for other parameter values are cached separately
  const [entry, setEntry] = useState<Entry | undefined>(() => (chartId ? peek(chartId + suffix) : undefined));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartId) return;
    let alive = true;
    const cached = peek(chartId + suffix);
    if (cached) setEntry(cached);
    if (tick === 0 && isFresh(cached)) return;
    (async () => {
      try {
        if (dashboardId) await ensureBundle(dashboardId, `${dashboardId}:${tick}${suffix}`, tick > 0, params.values, suffix);   // one request for the whole dashboard
        const got = peek(chartId + suffix);
        const e = got && (tick === 0 ? isFresh(got) : Date.now() - got.at < 10_000) ? got : suffix ? null : await loadChart(chartId, tick > 0);   // a single-chart request can't carry parameter values
        if (!e) throw new Error('This widget could not run with these parameter values.');
        if (alive) { setEntry(e); setError(null); }
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [chartId, tick, dashboardId, suffix]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { chart: entry?.chart ?? null, data: entry?.data ?? null, error };
}
