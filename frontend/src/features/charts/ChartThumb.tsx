import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Chart, QueryResult } from '@/lib/types';
import { ChartView } from './render/ChartView';

const cache = new Map<string, QueryResult>();

/** Live mini-preview of a saved chart. Loads its data only once it scrolls into view. */
export function ChartThumb({ chart, height = 150 }: { chart: Chart; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<QueryResult | null>(cache.get(chart.id) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (data || !ref.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      api.get<QueryResult>(`/charts/${chart.id}/data`)
        .then((r) => { const slim = { ...r, rows: r.rows.slice(0, 300) }; cache.set(chart.id, slim); setData(slim); })
        .catch(() => setFailed(true));
    }, { rootMargin: '120px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [chart.id, data]);

  return (
    <div ref={ref} className="pointer-events-none overflow-hidden" style={{ height }}>
      {data ? <ChartView spec={{ ...chart.spec, options: { ...chart.spec.options, showLegend: false, chartTitle: '', chartSubtitle: '', background: 'none', animate: false } }} result={data} height={height} />
        : <div className="grid h-full place-items-center text-xs text-muted-foreground">{failed ? 'Preview unavailable' : 'Loading…'}</div>}
    </div>
  );
}
