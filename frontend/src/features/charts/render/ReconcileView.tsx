import { useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { exactValue, formatValue, opt, type Opts } from '../format';
import { reconcile } from '../reconcile';

/** A small stat: label wraps instead of being cut, the number is compact (full value on hover). */
const Tile = ({ label, value, exact, sub, tone }: { label: string; value: string; exact?: string; sub?: string; tone?: 'good' | 'bad' }) => (
  <div className="min-w-0 rounded-lg border bg-card px-2.5 py-2" title={exact ? `${label}: ${exact}` : label}>
    <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    <div className={cn('text-base font-semibold tabular-nums leading-snug', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</div>
    {sub && <div className="text-[11px] leading-tight text-muted-foreground">{sub}</div>}
  </div>
);

/**
 * Reconcile 2-3 sources per key: one plain-language verdict, compact stats that fit any widget width, then the rows
 * (only the differing ones while there are any; every row, with its difference, when everything matches).
 */
export function ReconcileView({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const sources = (spec.encoding.ys?.length ? spec.encoding.ys : [spec.encoding.y]).filter(Boolean).slice(0, 3);
  const tol = opt.num(o.tolerance, 0);
  const [onlyDiff, setOnlyDiff] = useState<boolean | null>(null);
  if (sources.length < 2) return <p className="p-6 text-center text-sm text-muted-foreground">Pick 2 or 3 source columns to compare.</p>;
  const s = reconcile(result.rows, spec.encoding.x, sources, tol);
  const label = (c: string) => c.replace(/_/g, ' ');
  const keyName = label(spec.encoding.x);
  const fo = { ...o, numberFormat: o.numberFormat && o.numberFormat !== 'auto' ? o.numberFormat : 'compact' };
  const n = (v: number | null) => (v === null ? '—' : formatValue(v, fo));
  const differ = onlyDiff ?? s.mismatched > 0;   // default: show the problems when there are some, else everything
  const rows = (differ ? s.rows.filter((r) => r.diff > tol) : s.rows).slice(0, opt.num(o.limit, 0) || 200);
  const ok = s.mismatched === 0;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
      <p className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium', ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
        {ok ? <CheckCircle2 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
        {ok ? `All ${s.rows.length.toLocaleString()} ${keyName} values agree${tol ? ` within ±${tol}` : ''}.`
          : `${s.mismatched.toLocaleString()} of ${s.rows.length.toLocaleString()} ${keyName} values differ · total difference ${n(s.totalDiff)}${s.largest ? ` · largest: ${s.largest.key} (${n(s.largest.diff)})` : ''}`}
      </p>
      <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))' }}>
        {sources.map((c, i) => <Tile key={c} label={label(c)} value={n(s.totals[i])} exact={exactValue(s.totals[i], o)} />)}
        <Tile label="Match rate" value={`${(s.matchRate * 100).toFixed(1)}%`} sub={`${s.matched.toLocaleString()} of ${s.rows.length.toLocaleString()}`} tone={s.matchRate >= 0.99 ? 'good' : 'bad'} />
        <Tile label="Missing per source" value={s.missing.join(' / ')} sub={s.missing.some(Boolean) ? 'empty or zero' : 'none missing'} tone={s.missing.some(Boolean) ? 'bad' : undefined} />
      </div>
      <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={differ} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only rows that differ</label>
        <span>{rows.length.toLocaleString()} rows</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-muted text-left"><tr>
            <th className="px-2 py-1.5 capitalize">{keyName}</th>
            {sources.map((c) => <th key={c} className="px-2 py-1.5 text-right capitalize">{label(c)}</th>)}
            <th className="px-2 py-1.5 text-right">Difference</th>
          </tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-2 py-1 font-medium">{r.key}</td>
                {r.values.map((v, i) => <td key={i} className={cn('px-2 py-1 text-right', r.missing[i] && 'text-destructive')} title={exactValue(v, o)}>{n(v)}</td>)}
                <td className={cn('px-2 py-1 text-right font-semibold', r.diff > tol ? 'text-destructive' : 'text-muted-foreground')} title={exactValue(r.diff, o)}>{r.diff ? n(r.diff) : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No rows to show.</p>}
      </div>
    </div>
  );
}
