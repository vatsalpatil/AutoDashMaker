import { Fragment, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { AVERAGED, CALCS, pivot } from '../chartData';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { parseRules, ruleStyle } from '../tableStyle';


const SIZE = { xs: 'text-xs', sm: 'text-sm', md: 'text-base' } as const;

/** Cross-tab of the query rows: rows × columns with totals and optional heatmap shading. */
export function PivotTable({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  // every numeric column besides the row / column fields is a metric the viewer can switch between
  const { x, color } = spec.encoding;
  const metrics = result.columns.filter((c) => c !== x && c !== color
    && result.rows.slice(0, 20).some((r) => r[c] !== null && r[c] !== '' && Number.isFinite(toNumber(r[c]))));
  const [picked, setPicked] = useState<string | null>(null);
  const [calc, setCalc] = useState<string | null>(null);
  const metric = picked && metrics.includes(picked) ? picked : (metrics.includes(spec.encoding.y) ? spec.encoding.y : metrics[0] ?? spec.encoding.y);
  const agg = calc ?? o.pivotAgg ?? (AVERAGED.test(metric) ? 'avg' : 'sum');
  const p = pivot(result, { ...spec, encoding: { ...spec.encoding, y: metric } }, { ...o, pivotAgg: agg });
  const heat = o.pivotHeatmap === true;
  const rules = parseRules(o.cellRules);   // colour rules win over heatmap shading
  const pad = opt.str(o.tableDensity, 'compact') === 'comfortable' ? 'px-3 py-2.5' : 'px-3 py-1.5';
  const shade = (v: number | null) => {
    if (!heat || v === null || p.max === p.min) return undefined;
    const t = (v - p.min) / (p.max - p.min);
    return { background: `color-mix(in oklab, var(--primary) ${Math.round(8 + t * 55)}%, transparent)` };
  };
  const rowLabel = spec.encoding.x || 'Rows';
  // viewer-side search over row labels and click-to-sort on any header ('' = row label, '__total' = Total column)
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const valueOf = (r: string, k: string) => (k === '' ? r : k === '__total' ? p.rowTotal(r) : p.cell(r, k));
  const rows = p.rowKeys.filter((r) => !q || String(r).toLowerCase().includes(q.toLowerCase()));
  if (sort) rows.sort((a, b) => {
    const va = valueOf(a, sort.key), vb = valueOf(b, sort.key);
    if (va === null || va === '') return 1;
    if (vb === null || vb === '') return -1;
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * sort.dir;
  });
  const cycle = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: key === '' ? 1 : -1 } : s.dir === (key === '' ? 1 : -1) ? { key, dir: s.dir === 1 ? -1 : 1 } : null));
  const head = (key: string, label: string, right = true) => (
    <TableHead className={`${pad} font-semibold ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => cycle(key)} className={`inline-flex items-center gap-1 hover:text-primary ${right ? 'flex-row-reverse' : ''}`} title="Sort">
        {label}{sort?.key === key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
    <div className="flex shrink-0 flex-wrap items-end gap-2">
      {metrics.length > 1 && (
        <div className="w-48"><SelectField label="Metric" value={metric} onChange={(e) => setPicked(e.target.value)}>
          {metrics.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </SelectField></div>
      )}
      <div className="w-44"><SelectField label="Calculation" value={String(agg)} onChange={(e) => setCalc(e.target.value)}>
        {CALCS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </SelectField></div>
      <div className="relative ml-auto w-52">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${rowLabel}…`} aria-label="Filter rows"
          className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm outline-none focus-visible:border-ring" />
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
      <Table className={SIZE[opt.str(o.tableFontSize, 'sm') as keyof typeof SIZE] ?? 'text-sm'}>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            {head('', rowLabel, false)}
            {p.colKeys.map((c) => <Fragment key={c}>{head(c, c || '(blank)')}</Fragment>)}
            {o.pivotRowTotals !== false && head('__total', 'Total')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r} className={o.tableStriped === true && i % 2 ? 'bg-muted/40' : ''}>
              <TableCell className={`${pad} font-medium`}>{r || '(blank)'}</TableCell>
              {p.colKeys.map((c) => {
                const v = p.cell(r, c);
                return <TableCell key={c} className={`${pad} text-right tabular-nums`} style={ruleStyle(rules, metric, v, o.ruleFill === 'fill') ?? shade(v)}>{v === null ? '' : formatValue(v, o)}</TableCell>;
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
