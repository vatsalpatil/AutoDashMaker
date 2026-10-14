import type { Table } from '@tanstack/react-table';
import type { DataGridFeatures } from '@/components/reui/data-grid/data-grid';
import { DataGridTableFootRow, DataGridTableFootRowCell } from '@/components/reui/data-grid/data-grid-table';
import { AVERAGED, CALCS, aggregate, type Agg } from '@/features/charts/chartData';
import type { Row } from './dataGridColumns';

const isNum = (v: unknown) => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '');

/** Total row for the results table, like the pivot's: one value per numeric column over the rows that pass search and
 *  filters, with a calculation picker in the first cell ('auto' = average for ratio-like columns, sum otherwise). */
export function DataGridTotals({ table, calc, onCalc }: { table: Table<DataGridFeatures, Row>; calc: Agg | 'auto'; onCalc: (c: Agg | 'auto') => void }) {
  const rows = table.getPrePaginatedRowModel().rows.map((r) => r.original as Row);
  const cols = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
  return (
    <DataGridTableFootRow>
      {cols.map((c, k) => {
        const vals = rows.map((r) => r[c.id]);
        const numeric = vals.some(isNum) && vals.every((v) => v === null || v === undefined || v === '' || isNum(v));
        const agg: Agg = calc === 'auto' ? (AVERAGED.test(c.id) ? 'avg' : 'sum') : calc;
        if (k === 0) {
          return (
            <DataGridTableFootRowCell key={c.id} className="font-semibold text-foreground">
              <select value={calc} onChange={(e) => onCalc(e.target.value as Agg | 'auto')} aria-label="Total calculation"
                className="-mx-1 rounded bg-transparent px-1 font-semibold outline-none hover:bg-muted" title="How the total row is calculated">
                <option value="auto">Total</option>
                {CALCS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </DataGridTableFootRowCell>
          );
        }
        return (
          <DataGridTableFootRowCell key={c.id} className="text-right font-semibold tabular-nums text-foreground">
            {numeric ? fmt(aggregate(vals.filter(isNum).map(Number), agg)) : ''}
          </DataGridTableFootRowCell>
        );
      })}
    </DataGridTableFootRow>
  );
}
