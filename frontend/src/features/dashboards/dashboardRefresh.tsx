import { createContext, useContext, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/kit';

/** Dashboard refresh: a manual button and Metabase's auto-refresh choices. Widgets re-fetch their data whenever `tick` changes. */
export const RefreshContext = createContext(0);
export const useRefreshTick = () => useContext(RefreshContext);

const EVERY: [number, string][] = [[0, 'Auto-refresh: off'], [1, 'Every minute'], [5, 'Every 5 minutes'], [10, 'Every 10 minutes'], [15, 'Every 15 minutes'], [30, 'Every 30 minutes'], [60, 'Every hour']];

export function useDashboardRefresh() {
  const [tick, setTick] = useState(0);
  const [every, setEvery] = useState(0);
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => setTick((n) => n + 1), every * 60_000);
    return () => clearInterval(t);
  }, [every]);
  useEffect(() => setAt(new Date()), [tick]);
  const control = (
    <span className="flex items-center gap-1.5">
      <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} label="Refresh" title={`Last updated ${at.toLocaleTimeString()}`} onClick={() => setTick((n) => n + 1)} />
      <select value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="Auto-refresh" title="Auto-refresh"
        className="h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {EVERY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </span>
  );
  return { tick, control };
}
