import { useState } from 'react';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatValue, opt, type Opts } from '../format';
import { reconcile } from '../reconcile';

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) => (
  <div className="rounded-lg border bg-card px-3 py-2">
    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn('text-lg font-semibold tabular-nums', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</div>
    {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

/**
 * Reconcile 2-3 sources per key: match rate, mismatched keys, total / largest difference, keys missing per source,
 * then the rows with the biggest differences (toggle to see every row).
 */
export function ReconcileView({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const sources = (spec.encoding.ys?.length ? spec.encoding.ys : [spec.encoding.y]).filter(Boolean).slice(0, 3);
  const [onlyDiff, setOnlyDiff] = useState(true);
  if (sources.length < 2) return <p className="p-6 text-center text-sm text-muted-foreground">Pick 2 or 3 source columns to compare.</p>;
  const s = reconcile(result.rows, spec.encoding.x, sources, opt.num(o.tolerance, 0));
  const label = (c: string) => c.replace(/_/g, ' ');
  const rows = (onlyDiff ? s.rows.filter((r) => r.diff > opt.num(o.tolerance, 0)) : s.rows).slice(0, opt.num(o.limit, 0) || 200);
  const n = (v: number | null) => (v === null ? '—' : formatValue(v, o));
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {sources.map((c, i) => <Tile key={c} label={label(c)} value={n(s.totals[i])} />)}
        <Tile label="Match rate" value={`${(s.matchRate * 100).toFixed(1)}%`} sub={`${s.matched.toLocaleString()} of ${s.rows.length.toLocaleString()} keys`} tone={s.matchRate >= 0.99 ? 'good' : 'bad'} />
        <Tile label="Mismatched" value={s.mismatched.toLocaleString()} sub={`total diff ${n(s.totalDiff)} · avg ${n(Math.round(s.avgDiff))}`} tone={s.mismatched ? 'bad' : 'good'} />
        <Tile label="Largest diff" value={s.largest ? n(s.largest.diff) : '—'} sub={s.largest?.key} />
        <Tile label="Missing in source" value={s.missing.join(' / ')} sub={sources.map(label).join(' / ')} />
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only rows that differ
      </label>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-muted text-left"><tr>
            <th className="px-2 py-1.5">{label(spec.encoding.x)}</th>
            {sources.map((c) => <th key={c} className="px-2 py-1.5 text-right">{label(c)}</th>)}
            <th className="px-2 py-1.5 text-right">Diff</th>
          </tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-2 py-1 font-medium">{r.key}</td>
                {r.values.map((v, i) => <td key={i} className={cn('px-2 py-1 text-right', r.missing[i] && 'text-destructive')}>{n(v)}</td>)}
                <td className={cn('px-2 py-1 text-right font-semibold', r.diff > 0 && 'text-destructive')}>{n(r.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Every key matches.</p>}
      </div>
    </div>
  );
}
