import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { pivot } from '../chartData';
import { formatValue, opt, type Opts } from '../format';

const SIZE = { xs: 'text-xs', sm: 'text-sm', md: 'text-base' } as const;

/** Cross-tab of the query rows: rows × columns with totals and optional heatmap shading. */
export function PivotTable({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const p = pivot(result, spec, o);
  const heat = o.pivotHeatmap === true;
  const pad = opt.str(o.tableDensity, 'compact') === 'comfortable' ? 'px-3 py-2.5' : 'px-3 py-1.5';
  const shade = (v: number | null) => {
    if (!heat || v === null || p.max === p.min) return undefined;
    const t = (v - p.min) / (p.max - p.min);
    return { background: `color-mix(in oklab, var(--primary) ${Math.round(8 + t * 55)}%, transparent)` };
  };
  const rowLabel = spec.encoding.x || 'Rows';

  return (
    <div className="max-h-full overflow-auto rounded-lg border">
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
  );
}
