import { api, onWrite } from '@/lib/api';
import type { Chart, QueryResult } from '@/lib/types';

/**
 * Client-side cache for chart data (stale-while-revalidate).
 *  - A widget shows what we already have at once, and only re-asks the server when the entry is older than FRESH_MS.
 *  - A dashboard loads all its widgets with ONE batch request (`ensureBundle`); the server runs them concurrently.
 *  - The same chart asked for by several components (title, body, fullscreen, print) shares one request (`loadChart`).
 */
export interface Entry { chart: Chart; data: QueryResult; at: number }
interface Bundle { [chartId: string]: { chart?: Chart; data?: QueryResult; error?: string } }

export const FRESH_MS = 60_000;
const MAX_ENTRIES = 300;
const entries = new Map<string, Entry>();          // chart id -> latest copy (insertion order = recency)
const flights = new Map<string, Promise<Entry>>(); // chart id (+ ':f' for fresh) -> request in flight
const bundles = new Map<string, Promise<void>>();  // batch key -> request in flight

export const peek = (chartId: string): Entry | undefined => entries.get(chartId);
export const isFresh = (e: Entry | undefined, now = Date.now()): boolean => !!e && now - e.at < FRESH_MS;

function put(chartId: string, chart: Chart, data: QueryResult): Entry {
  const e = { chart, data, at: Date.now() };
  entries.delete(chartId);
  entries.set(chartId, e);
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  return e;
}

/** One chart's spec + data. Concurrent callers for the same chart share a single request. */
export function loadChart(chartId: string, fresh = false): Promise<Entry> {
  const key = fresh ? `${chartId}:f` : chartId;
  let p = flights.get(key);
  if (!p) {
    p = Promise.all([api.get<Chart>(`/charts/${chartId}`), api.get<QueryResult>(`/charts/${chartId}/data${fresh ? '?fresh=true' : ''}`)])
      .then(([chart, data]) => put(chartId, chart, data))
      .finally(() => flights.delete(key));
    flights.set(key, p);
  }
  return p;
}

/** Every chart of a dashboard in one request. `key` makes a repeated call (every widget asks) share the first one. */
export function ensureBundle(dashboardId: string, key: string, fresh = false): Promise<void> {
  let p = bundles.get(key);
  if (!p) {
    p = api.post<Bundle>(`/dashboards/${dashboardId}/data${fresh ? '?fresh=true' : ''}`)
      .then((b) => { for (const [id, r] of Object.entries(b)) if (r.chart && r.data) put(id, r.chart, r.data); })
      .catch(() => { /* each widget falls back to its own request */ })
      .finally(() => { setTimeout(() => bundles.delete(key), 5000); });   // remembered briefly so late widgets still share it
    bundles.set(key, p);
  }
  return p;
}

/** Fill the cache from an already-fetched bundle and keep it fresh for good (public share pages cannot re-ask the signed-in API). */
export function prime(bundle: Bundle): void {
  for (const [id, r] of Object.entries(bundle)) if (r.chart && r.data) entries.set(id, { chart: r.chart, data: r.data, at: Number.POSITIVE_INFINITY });
}

/** Forget everything (tests, sign-out). */
export function clearDataCache(): void { entries.clear(); flights.clear(); bundles.clear(); }

onWrite(clearDataCache);   // a chart, query, dataset or dashboard changed somewhere: start clean
