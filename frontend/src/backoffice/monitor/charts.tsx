import { useEffect, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { num } from '../format';
import { Section } from '../parts/Section';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;
export const right = 'text-right tabular-nums';
const tip = { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };
const axis = { fontSize: 11, stroke: 'var(--muted-foreground)' };

/** useApi that re-fetches every `ms` while the page is visible (live views). */
export function usePoll<T>(path: string, ms: number, on = true) {
  const state = useApi<T>(path);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { if (!document.hidden) state.reload(); }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ms, on]);
  return state;
}

/** Time series (area or bars), any x key, one colour per series. */
export function SeriesChart({ title, description, data, x, series, bars, height = 'h-52', unit }: {
  title: ReactNode; description?: ReactNode; data: Row[]; x: string; series: { key: string; label: string }[];
  bars?: boolean; height?: string; unit?: string;
}) {
  const Chart = bars ? BarChart : AreaChart;
  return (
    <Section title={title} description={description}>
      <div className={height}>
        <ResponsiveContainer>
          <Chart data={data} margin={{ left: -12, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={x} {...axis} minTickGap={16} />
            <YAxis {...axis} unit={unit} />
            <Tooltip contentStyle={tip} />
            {series.map((s, i) => bars
              ? <Bar key={s.key} dataKey={s.key} name={s.label} fill={`var(--chart-${i + 1})`} radius={[3, 3, 0, 0]} stackId="a" isAnimationActive={false} />
              : <Area key={s.key} dataKey={s.key} name={s.label} type="monotone" strokeWidth={2} stroke={`var(--chart-${i + 1})`}
                  fill={`var(--chart-${i + 1})`} fillOpacity={0.15} isAnimationActive={false} connectNulls />)}
          </Chart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

/** Ranked horizontal bars: label · bar · value (status codes, areas, devices…). */
export function BarList({ title, description, rows, value = 'n', label = 'label', extra }: {
  title: ReactNode; description?: ReactNode; rows: Row[]; value?: string; label?: string; extra?: (r: Row) => ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value]) || 0));
  return (
    <Section title={title} description={description}>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">No data yet.</div>}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate" title={String(r[label])}>{r[label] || '—'}</span>
            <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(100 * (Number(r[value]) || 0)) / max}%` }} /></div>
            <span className="tabular-nums text-muted-foreground">{num(r[value])}{extra && <span className="ml-1 text-xs">{extra(r)}</span>}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Percentage meter for CPU / memory / disk. */
export function Meter({ label, pct, hint }: { label: string; pct: number | null | undefined; hint?: ReactNode }) {
  const v = pct ?? 0;
  return (
    <Section title={label}>
      <div className={cn('text-3xl font-semibold tabular-nums', v > 85 && 'text-destructive')}>{pct == null ? '—' : `${v.toFixed(1)}%`}</div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div className={cn('h-2 rounded-full transition-all', v > 85 ? 'bg-destructive' : v > 65 ? 'bg-chart-4' : 'bg-primary')} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Section>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekday × hour (UTC) request heatmap. */
export function Heatmap({ rows }: { rows: { dow: number; hour: number; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const at = new Map(rows.map((r) => [`${r.dow}-${r.hour}`, r.n]));
  return (
    <Section title="When people use it" description="Requests by weekday and hour (UTC), last 28 days">
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,1fr)] gap-0.5 text-[10px] text-muted-foreground">
          <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 ? '' : h}</span>)}
          {DAYS.map((d, dow) => [
            <span key={d}>{d}</span>,
            ...Array.from({ length: 24 }, (_, h) => {
              const n = at.get(`${dow}-${h}`) ?? 0;
              return <div key={`${d}${h}`} title={`${d} ${h}:00 · ${n} requests`} className="h-4 rounded-sm bg-primary"
                style={{ opacity: n ? 0.12 + (0.88 * n) / max : 0.04 }} />;
            }),
          ])}
        </div>
      </div>
    </Section>
  );
}
