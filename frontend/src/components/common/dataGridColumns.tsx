import type { ColumnDef } from '@tanstack/react-table';
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header';
import type { DataGridFeatures } from '@/components/reui/data-grid/data-grid';
import { fmt } from '@/lib/utils';
import { ColumnFilter, type FilterValue } from './ColumnFilter';
import { isRule, ruleMatches, type ColKind } from './ColumnRuleFilter';

export type Row = Record<string, unknown>;

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(v);
const isNum = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? Number.NEGATIVE_INFINITY : Number(v));

export const cellText = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

const CHAR_PX = 8;      // average glyph width of the grid's dense text
const HEADER_CHAR_PX = 9;   // semibold header text
const HEADER_EXTRA = 104;    // sort icon, column-menu button, cell padding and room for an active-filter marker
const MIN_W = 96;
const MAX_W = 480;

/** Default column width: wide enough for what 80% of the loaded values need (so a few very long outliers get ellipsised
 *  instead of stretching the column), never narrower than the header with its sort, menu and filter icons. */
function autoWidth(title: string, shown: string[]): number {
  const lens = shown.map((t) => t.length).sort((a, b) => a - b);
  const p80 = lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.8))] : 0;
  const header = title.length * HEADER_CHAR_PX + HEADER_EXTRA;
  return Math.round(Math.min(MAX_W, Math.max(MIN_W, header, p80 * CHAR_PX + 28)));
}

/** Column definitions for ReUI's Data Grid from plain column names + rows: numeric sorting and alignment,
 *  a pick-list filter on low-cardinality columns, NULL styling. */
export function buildColumns(columns: string[], rows: Row[], leftAlign = false): ColumnDef<DataGridFeatures, Row>[] {
  const sample = rows.slice(0, 200);
  const widthSample = rows.slice(0, 1000);
  return columns.map((c) => {
    const values = sample.map((r) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
    const numeric = values.length > 0 && values.every(isNum);
    const kind: ColKind = numeric ? 'num' : values.length > 0 && values.every(isDate) ? 'date' : 'text';
    const counts = new Map<string, number>();
    for (const r of rows) { const t = cellText(r[c]); counts.set(t, (counts.get(t) ?? 0) + 1); }
    const filterValues: FilterValue[] = [...counts].map(([value, count]) => ({ value, count }))
      .sort((a, b) => (kind === 'num' ? num(a.value) - num(b.value) : a.value.localeCompare(b.value, undefined, { numeric: true })));
    return {
      id: c,
      accessorFn: (r: Row) => r[c],
      size: autoWidth(c, widthSample.map((r) => r[c]).filter((v) => v !== null && v !== undefined).map((v) => (numeric ? fmt(v) : cellText(v)))),
      minSize: 80,
      header: ({ column }) => (
        <div className="flex min-w-0 items-center gap-0.5">
          <div className="min-w-0 flex-1"><DataGridColumnHeader column={column} title={c} visibility /></div>
          <ColumnFilter column={column} title={c} kind={kind} values={filterValues} />
        </div>
      ),
      cell: ({ getValue }) => {
        const v = getValue();
        if (v === null || v === undefined) return <span className="text-xs text-muted-foreground/60">NULL</span>;
        return <span className={numeric && !leftAlign ? 'block text-right tabular-nums' : 'block truncate'} title={cellText(v)}>{numeric ? fmt(v) : cellText(v)}</span>;
      },
      sortFn: numeric ? (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }) => num(a.getValue(c)) - num(b.getValue(c)) : undefined,
      filterFn: (row: { getValue: (id: string) => unknown }, id: string, value: unknown) =>
        isRule(value) ? ruleMatches(row.getValue(id), value, kind)
          : !Array.isArray(value) || value.length === 0 || value.includes(cellText(row.getValue(id))),
      meta: { headerTitle: c },
    } as ColumnDef<DataGridFeatures, Row>;
  });
}
