import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { pivot } from '../chartData';
import { formatValue, opt, toNumber, type Opts } from '../format';

/** Ratios and averages must be averaged, not summed, in totals. */
const AVERAGED = /(avg|average|mean|margin|ratio|rate|pct|percent|share|price)/i;

const SIZE = { xs: 'text-xs', sm: 'text-sm', md: 'text-base' } as const;

/** Cross-tab of the query rows: rows × columns with totals and optional heatmap shading. */
export function PivotTable({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  // every numeric column besides the row / column fields is a metric the viewer can switch between
  const { x, color } = spec.encoding;
  const metrics = result.columns.filter((c) => c !== x && c !== color
    && result.rows.slice(0, 20).some((r) => r[c] !== null && r[c] !== '' && Number.isFinite(toNumber(r[c]))));
  const [picked, setPicked] = useState<string | null>(null);
  const metric = picked && metrics.includes(picked) ? picked : (metrics.includes(spec.encoding.y) ? spec.encoding.y : metrics[0] ?? spec.encoding.y);
  const agg = o.pivotAgg ?? (AVERAGED.test(metric) ? 'avg' : 'sum');
  const p = pivot(result, { ...spec, encoding: { ...spec.encoding, y: metric } }, { ...o, pivotAgg: agg });
  const heat = o.pivotHeatmap === true;
  const pad = opt.str(o.tableDensity, 'compact') === 'comfortable' ? 'px-3 py-2.5' : 'px-3 py-1.5';
  const shade = (v: number | null) => {
    if (!heat || v === null || p.max === p.min) return undefined;
    const t = (v - p.min) / (p.max - p.min);
    return { background: `color-mix(in oklab, var(--primary) ${Math.round(8 + t * 55)}%, transparent)` };
  };
  const rowLabel = spec.encoding.x || 'Rows';

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
    {metrics.length > 1 && (
      <div className="flex shrink-0 flex-wrap items-center gap-1" role="radiogroup" aria-label="Metric">
        <span className="mr-1 text-[11px] text-muted-foreground">Show</span>
        {metrics.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={m === metric} onClick={() => setPicked(m)}
            className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors', m === metric ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary hover:text-primary')}>
            {m.replace(/_/g, ' ')}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{agg === 'avg' ? 'totals = average' : 'totals = sum'}</span>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
      <Table className={SIZE[opt.str(o.tableFontSize, 'sm') as keyof typeof SIZE] ?? 'text-sm'}>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead className={`${pad} font-semibold`}>{rowLabel}</TableHead>
            {p.colKeys.map((c) => <TableHead key={c} className={`${pad} text-right font-semibold`}>{c || '(blank)'}</TableHead>)}
            {o.pivotRowTotals !== false && <TableHead className={`${pad} text-right font-semibold`}>Total</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.rowKeys.map((r, i) => (
            <TableRow key={r} className={o.tableStriped === true && i % 2 ? 'bg-muted/40' : ''}>
              <TableCell className={`${pad} font-medium`}>{r || '(blank)'}</TableCell>
              {p.colKeys.map((c) => {
                const v = p.cell(r, c);
                return <TableCell key={c} className={`${pad} text-right tabular-nums`} style={shade(v)}>{v === null ? '' : formatValue(v, o)}</TableCell>;
              })}
              {o.pivotRowTotals !== false && <TableCell className={`${pad} text-right font-semibold tabular-nums`}>{formatValue(p.rowTotal(r), o)}</TableCell>}
            </TableRow>
          ))}
          {o.pivotColTotals !== false && (
            <TableRow className="bg-muted/60 font-semibold">
              <TableCell className={pad}>Total</TableCell>
              {p.colKeys.map((c) => <TableCell key={c} className={`${pad} text-right tabular-nums`}>{formatValue(p.colTotal(c), o)}</TableCell>)}
              {o.pivotRowTotals !== false && <TableCell className={`${pad} text-right tabular-nums`}>{formatValue(p.grand, o)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
