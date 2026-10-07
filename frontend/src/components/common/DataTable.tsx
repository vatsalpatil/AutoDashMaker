import { fmt } from '@/lib/utils';

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  maxRows?: number;
  fontSize?: 'xs' | 'sm' | 'md';
  density?: 'compact' | 'comfortable';
  striped?: boolean;
}

const FONT_SIZE: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
};

export function DataTable({ columns, rows, maxRows = 500, fontSize = 'sm', density = 'compact', striped = false }: DataTableProps) {
  const shown = rows.slice(0, maxRows);
  const cellPad = density === 'comfortable' ? 'px-3 py-2.5' : 'px-3 py-1.5';
  const headPad = density === 'comfortable' ? 'px-3 py-3' : 'px-3 py-2';
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className={`min-w-full divide-y divide-border ${FONT_SIZE[fontSize] ?? 'text-sm'}`}>
        <thead className="bg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className={`whitespace-nowrap ${headPad} text-left font-semibold text-foreground`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card ">
          {shown.map((r, i) => (
            <tr
              key={i}
              className={`hover:bg-muted/40 ${striped && i % 2 === 1 ? 'bg-muted/50' : ''}`}
            >
              {columns.map((c, j) => (
                <td key={j} className={`whitespace-nowrap ${cellPad} text-foreground`}>
                  {fmt(r[c])}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-3 py-6 text-center text-muted-foreground">
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          Showing first {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
