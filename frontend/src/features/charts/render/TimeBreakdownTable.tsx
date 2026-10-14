import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Minus, Plus, Search } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AVERAGED, CALCS, aggregate, type Agg } from '../chartData';
import { formatValue, opt, type Opts } from '../format';
import { buildBreakdown, cellValue, footerValue, splitKey, timeColumns, type TBRow, type TimeCol } from '../timeBreakdown';

type VCol = TimeCol & { base: string; group: string; total?: boolean };

const PAGE_SIZES = [20, 50, 100, 200];
const isNum = (result: QueryResult, c: string) => result.rows.slice(0, 30).some((r) => r[c] !== null && r[c] !== '' && Number.isFinite(Number(r[c])));

/**
 * Time breakdown: one row per item (x), one column per year of the date field (color); click a year to open its months and a month
 * to open its days. Item details (text columns) sit before the periods; Total column + Total footer; metric and calculation pickers,
 * search, sort on any column, pages for long lists.
 */
export function TimeBreakdownCore({ spec, result, o }: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const { x: item, color: date = '' } = spec.encoding;
  const metrics = result.columns.filter((c) => c !== item && c !== date && isNum(result, c));
  const attrs = result.columns.filter((c) => c !== item && c !== date && !metrics.includes(c));
  const [picked, setPicked] = useState<string | null>(null);
  const metric = picked ?? (metrics.includes(spec.encoding.y) ? spec.encoding.y : metrics[0] ?? '');
  const [calc, setCalc] = useState<Agg | null>(null);
  const agg = calc ?? ((o.pivotAgg as Agg) || (AVERAGED.test(metric) ? 'avg' : 'sum'));
  const fn = (v: number[]) => aggregate(v, agg);
  const [split, setSplit] = useState(() => (attrs.includes(String(o.tbSplit)) ? String(o.tbSplit) : ''));
  const tb = useMemo(() => buildBreakdown(result.rows, item, date, metric, attrs, split), [result.rows, item, date, metric, attrs.join(), split]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<Set<string>>(() => new Set(o.tbOpen === 'month' ? tb.years : []));
  const [hidden, setHidden] = useState<Set<string>>(new Set());   // detail columns the viewer turned off
  const shownAttrs = attrs.filter((a) => !hidden.has(a));
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) { n.delete(k); for (const m of tb.monthsOf.get(k) ?? []) n.delete(m); } else n.add(k); return n; });
  const cols = timeColumns(tb, open);
  // split: every split value gets its own group of period columns + its own total; else plain periods grouped by year
  const vcols: VCol[] = split
    ? tb.splits.flatMap((g) => [...cols.map((c) => ({ ...c, key: splitKey(g, c.key), base: c.key, group: g })),
      { key: splitKey(g, '__total'), label: 'Total', level: 'year' as const, year: '', expandable: false, base: '', group: g, total: true }])
    : cols.map((c) => ({ ...c, base: c.key, group: c.year }));
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: '__total', dir: -1 });
  const [size, setSize] = useState(Number(o.tbPageSize) || PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const sortVal = (r: TBRow, k: string): number | string | null => (k === '' ? r.id : k in r.attrs ? (r.attrs[k] as string) : cellValue(r, k, fn));
  const rows = tb.rows.filter((r) => !q || [r.id, ...Object.values(r.attrs)].some((v) => String(v ?? '').toLowerCase().includes(q.toLowerCase())));
  rows.sort((a, b) => {
    const va = sortVal(a, sort.key), vb = sortVal(b, sort.key);
    if (va === null || va === '') return 1;
    if (vb === null || vb === '') return -1;
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * sort.dir;
  });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const shown = rows.slice(Math.min(page, pages - 1) * size, (Math.min(page, pages - 1) + 1) * size);
  const pad = opt.str(o.tableDensity, 'compact') === 'comfortable' ? 'px-3 py-2' : 'px-2.5 py-1';
  const fmtV = (v: number | null) => (v === null ? '—' : formatValue(v, o));
  const sortBtn = (key: string, label: React.ReactNode, right = true) => (
    <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === '' || key in (tb.rows[0]?.attrs ?? {}) ? 1 : -1 }))}
      className={cn('inline-flex items-center gap-1 hover:text-primary', right && 'flex-row-reverse')} title="Sort by this column">
      {label}{sort.key === key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
    </button>
  );
  // grouped header: one cell per year spanning its visible columns, shown once any year is open
  const groups = (split ? tb.splits : tb.years).map((y) => ({ y, span: vcols.filter((c) => c.group === y).length }));
  const lead = 1 + shownAttrs.length;
  const all = rows.flatMap((r) => vcols.filter((c) => !c.total).map((c) => cellValue(r, c.key, fn)).filter((v): v is number => v !== null));
  const lo = Math.min(...all), hi = Math.max(...all);
  const heat = (v: number | null) => (o.pivotHeatmap !== true || v === null || hi === lo ? undefined
    : { background: `color-mix(in oklab, var(--primary) ${Math.round(6 + ((v - lo) / (hi - lo)) * 50)}%, transparent)` });

  if (!date) return <p className="p-6 text-center text-sm text-muted-foreground">Choose a date column for “Columns: time”.</p>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        {metrics.length > 1 && <div className="w-44"><SelectField label="Metric" value={metric} onChange={(e) => setPicked(e.target.value)}>{metrics.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</SelectField></div>}
        <div className="w-40"><SelectField label="Calculation" value={agg} onChange={(e) => setCalc(e.target.value as Agg)}>{CALCS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField></div>
        {attrs.length > 0 && <div className="w-40"><SelectField label="Split columns by" value={split} onChange={(e) => setSplit(e.target.value)}><option value="">No split</option>{attrs.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</SelectField></div>}
        {attrs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Detail columns">
            <span className="text-muted-foreground">Columns</span>
            {attrs.map((a) => (
              <button key={a} type="button" aria-pressed={!hidden.has(a)} onClick={() => setHidden((s) => { const n = new Set(s); if (n.has(a)) n.delete(a); else n.add(a); return n; })}
                className={cn('rounded-full border px-2 py-0.5', hidden.has(a) ? 'text-muted-foreground line-through' : 'border-primary/50 bg-primary/10')}>{a.replace(/_/g, ' ')}</button>
            ))}
          </div>
        )}
        <label className="relative ml-auto"><Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={`Search ${item}`} aria-label="Search rows" className="h-8 w-44 rounded-md border bg-transparent pl-7 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table className={cn('tabular-nums', o.tableFontSize === 'xs' ? 'text-xs' : 'text-sm')}>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {(open.size > 0 || split) && (
              <TableRow>
                <TableHead colSpan={lead} />
                {groups.map((g) => (
                  <TableHead key={g.y} colSpan={g.span} className="border-l text-center font-semibold">
                    {!split && open.has(g.y) ? <button type="button" onClick={() => toggle(g.y)} title={`Collapse ${g.y}`} className="inline-flex items-center gap-1 hover:text-primary"><Minus className="size-3" />{g.y}</button> : g.y}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            )}
            <TableRow>
              <TableHead className={cn(pad, 'sticky left-0 bg-card font-semibold')}>{sortBtn('', item.replace(/_/g, ' '), false)}</TableHead>
              {shownAttrs.map((a) => <TableHead key={a} className={cn(pad, 'font-semibold')}>{sortBtn(a, a.replace(/_/g, ' '), false)}</TableHead>)}
              {vcols.map((c) => (
                <TableHead key={c.key} className={cn(pad, 'whitespace-nowrap text-right font-semibold', c.level !== 'day' && 'border-l', c.total && 'bg-muted/50')}>
                  <span className="inline-flex items-center gap-1">
                    {c.expandable && (
                      <button type="button" onClick={() => toggle(c.base)} title={`Show ${c.label} by ${c.level === 'year' ? 'months' : 'days'}`} aria-label={`Expand ${c.label}`}
                        className="grid size-4 place-items-center rounded border text-muted-foreground hover:text-primary"><Plus className="size-3" /></button>
                    )}
                    {sortBtn(c.key, c.label)}
                  </span>
                </TableHead>
              ))}
              <TableHead className={cn(pad, 'border-l text-right font-semibold')}>{sortBtn('__total', 'Total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className={cn(pad, 'sticky left-0 bg-card font-medium')}>{r.id}</TableCell>
                {shownAttrs.map((a) => <TableCell key={a} className={pad}>{String(r.attrs[a] ?? '—')}</TableCell>)}
                {vcols.map((c) => { const v = cellValue(r, c.key, fn); return <TableCell key={c.key} style={c.total ? undefined : heat(v)} className={cn(pad, 'text-right', c.level !== 'day' && 'border-l', c.total && 'bg-muted/50 font-medium')}>{fmtV(v)}</TableCell>; })}
                <TableCell className={cn(pad, 'border-l text-right font-semibold')}>{fmtV(cellValue(r, '__total', fn))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="sticky bottom-0 bg-muted">
            <TableRow>
              <TableCell colSpan={lead} className={cn(pad, 'sticky left-0 bg-muted font-semibold')}>Total</TableCell>
              {vcols.map((c) => <TableCell key={c.key} className={cn(pad, 'text-right font-semibold', c.level !== 'day' && 'border-l')}>{fmtV(footerValue(rows, c.key, fn))}</TableCell>)}
              <TableCell className={cn(pad, 'border-l text-right font-semibold')}>{fmtV(footerValue(rows, '__total', fn))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{rows.length.toLocaleString()} rows</span>
        {open.size > 0 && <button type="button" onClick={() => setOpen(new Set())} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"><Minus className="size-3" /> Collapse all</button>}
        <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} aria-label="Rows per page" className="ml-auto h-7 rounded-md border bg-transparent px-1.5">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="rounded p-1 hover:bg-accent disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        <span>Page {Math.min(page, pages - 1) + 1} of {pages}</span>
        <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="rounded p-1 hover:bg-accent disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

/** Time breakdown with "Compare": 1, 2 or 3 copies side by side, each with its own metric, calculation, split and expansion. */
export function TimeBreakdownTable(props: { spec: ChartSpec; result: QueryResult; o: Opts }) {
  const [n, setN] = useState(1);
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" role="group" aria-label="Compare tables">
        Compare
        {[1, 2, 3].map((k) => (
          <button key={k} type="button" aria-pressed={n === k} onClick={() => setN(k)} title={k === 1 ? 'Single table' : `${k} tables side by side`}
            className={cn('grid size-6 place-items-center rounded border', n === k ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'hover:bg-accent')}>{k}</button>
        ))}
      </div>
      <div className={cn('grid min-h-0 flex-1 gap-3', n === 2 && 'lg:grid-cols-2', n === 3 && 'xl:grid-cols-3')}>
        {Array.from({ length: n }, (_, i) => <div key={i} className="min-h-0 min-w-0"><TimeBreakdownCore {...props} /></div>)}
      </div>
    </div>
  );
}
