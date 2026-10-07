import { useEffect, useMemo, useRef, useState } from 'react';
import { useTable, type RowSelectionState, type ColumnFiltersState, type PaginationState, type SortingState, type ColumnVisibilityState } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Download, Maximize2, Search, X } from 'lucide-react';
import { DataGrid as ReGrid, DataGridContainer, dataGridFeatures } from '@/components/reui/data-grid/data-grid';
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination';
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area';
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/kit';
import { useGridToolbar } from '@/hooks/useGridToolbar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { downloadRows } from '@/lib/exportRows';
import { cn } from '@/lib/utils';
import { DataGridColumnsMenu } from './DataGridColumnsMenu';
import { buildColumns, cellText, type Row } from './dataGridColumns';

const PAGE_SIZES = [10, 25, 50, 100, 250, 500, 1000];

interface DataGridProps {
  columns: string[];
  rows: Row[];
  /** Max height of the scrolling area; the header stays visible while rows scroll. */
  maxHeight?: string;
  /** Fills the height of its parent (the grid keeps its border and rounded corners). */
  fill?: boolean;
  /** Borderless but natural height (used inside notebook cells). */
  bare?: boolean;
  /** Keep numeric columns left-aligned too (profile-style tables). */
  leftAlign?: boolean;
  /** Show the full-screen button (opens the same data in a large popup). On by default; the popup itself turns it off. */
  expandable?: boolean;
}

/**
 * Results table on ReUI's Data Grid (TanStack Table): global search, per-column pick-list filters, sort,
 * pin / hide / resize / reorder columns, page size + pagination, CSV/JSON export of what you are looking at.
 */
export function DataGrid({ columns, rows, maxHeight = '65vh', fill = false, bare = false, leftAlign = false, expandable = true }: DataGridProps) {
  const [full, setFull] = useState(false);
  const [pageSize, setPageSize] = useLocalStorage('datagrid.pageSize', 25);
  const [toolbarOpen, setToolbarOpen] = useGridToolbar();   // search / columns / export row; shared and remembered
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});   // click = select one, Ctrl/Cmd+click = add/remove, Shift+click = range
  const mods = useRef({ multi: false, range: false });
  const anchor = useRef<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const colKey = columns.join('\u0001');
  const columnDefs = useMemo(() => buildColumns(columns, rows, leftAlign), [columns, rows, leftAlign]);

  // a different result set starts clean (pins/size/visibility of unknown columns would only confuse)
  useEffect(() => {
    setSorting([]); setRowSelection({}); setColumnFilters([]); setGlobalFilter(''); setColumnVisibility({});
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [colKey]);

  const table = useTable({
    features: dataGridFeatures,
    columns: columnDefs,
    data: rows,
    getRowId: (_r, i) => String(i),
    enableRowSelection: true,
    enableMultiRowSelection: true,
    state: { rowSelection, pagination, sorting, columnFilters, globalFilter, columnVisibility },
    onPaginationChange: (u) => setPagination((p) => {
      const next = typeof u === 'function' ? u(p) : u;
      if (next.pageSize !== p.pageSize) setPageSize(next.pageSize);
      return next;
    }),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const filtered = table.getPrePaginatedRowModel().rows.length;
  const activeFilters = columnFilters.length + (globalFilter ? 1 : 0);
  const exportRows = (f: 'csv' | 'json') => downloadRows(f, table.getVisibleLeafColumns().map((c) => c.id), table.getPrePaginatedRowModel().rows.map((r) => r.original));
  const copySelected = () => {
    const cols = table.getVisibleLeafColumns().map((c) => c.id);
    const lines = table.getRowModel().rows.filter((r) => rowSelection[r.id]).map((r) => cols.map((c) => cellText(r.original[c])).join('\t'));
    navigator.clipboard?.writeText([cols.join('\t'), ...lines].join('\n'));
  };
  const sizes = PAGE_SIZES.includes(pageSize) ? PAGE_SIZES : [...PAGE_SIZES, pageSize].sort((a, b) => a - b);

  return (
    <>
    <div className="contents" onClickCapture={(e) => { mods.current = { multi: e.ctrlKey || e.metaKey, range: e.shiftKey }; }}
      onMouseDownCapture={(e) => { if (e.shiftKey) e.preventDefault(); }}>
    <ReGrid table={table} recordCount={rows.length}
      onRowClick={(row) => {
        const id = String(rows.indexOf(row as Row));
        const order = table.getRowModel().rows.map((r) => r.id);
        const { multi, range } = mods.current;
        if (range && anchor.current !== null && order.includes(anchor.current)) {
          const [a, b] = [order.indexOf(anchor.current), order.indexOf(id)].sort((x, y) => x - y);
          setRowSelection((s) => ({ ...(multi ? s : {}), ...Object.fromEntries(order.slice(a, b + 1).map((r) => [r, true])) }));
          return;
        }
        anchor.current = id;
        setRowSelection((s) => {
          if (multi) { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = true; return n; }
          return s[id] && Object.keys(s).length === 1 ? {} : { [id]: true };
        });
      }}
      tableLayout={{ columnsPinnable: true, columnsResizable: true, columnsMovable: true, columnsVisibility: true, headerSticky: true, dense: true, cellBorder: false }}>
      <div className={cn('flex min-h-0 min-w-0 max-w-full flex-col bg-card', fill && 'h-full', !bare && 'overflow-hidden rounded-xl border shadow-xs')}>
        {toolbarOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <div className="relative min-w-40 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search all columns…" aria-label="Search rows"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-7 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            {globalFilter && <button type="button" aria-label="Clear search" onClick={() => setGlobalFilter('')} className="absolute right-1.5 top-2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
          </div>
          {activeFilters > 0 && (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => { setGlobalFilter(''); setColumnFilters([]); }}>
              Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
            </button>
          )}
          {Object.keys(rowSelection).length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              {Object.keys(rowSelection).length.toLocaleString()} selected
              <button type="button" className="underline-offset-2 hover:underline" onClick={copySelected}>Copy</button>
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => setRowSelection({})}>Clear</button>
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered === rows.length ? `${rows.length.toLocaleString()} rows` : `${filtered.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
          </span>
          <DataGridColumnsMenu table={table} />
          {(['csv', 'json'] as const).map((f) => (
            <Button key={f} variant="outline" size="sm" disabled={filtered === 0} onClick={() => exportRows(f)}
              title={`Download ${filtered.toLocaleString()} row(s) as ${f.toUpperCase()} — honours search, filters, sort and hidden columns`}>
              <Download className="size-3.5" /> <span className="uppercase">{f}</span>
            </Button>
          ))}
            {expandable && !bare && <Button variant="outline" size="sm" aria-label="Full screen" title="View in full screen" onClick={() => setFull(true)}><Maximize2 className="size-3.5" /></Button>}
            {!bare && <Button variant="ghost" size="sm" aria-label="Hide search and export" title="Hide search and export" onClick={() => setToolbarOpen(false)}><ChevronUp className="size-4" /></Button>}
          </div>
        ) : bare ? null : (
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <button type="button" onClick={() => setToolbarOpen(true)} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-accent hover:text-foreground" aria-label="Show search and export" title="Show search, columns and export">
              <ChevronDown className="size-4" /> Search &amp; export
            </button>
            <span className="ml-auto">{filtered === rows.length ? `${rows.length.toLocaleString()} rows` : `${filtered.toLocaleString()} of ${rows.length.toLocaleString()} rows`}</span>
            {activeFilters > 0 && <span className="font-medium text-primary">{activeFilters} filter{activeFilters === 1 ? '' : 's'} active</span>}
            {expandable && <button type="button" aria-label="Full screen" title="View in full screen" onClick={() => setFull(true)} className="rounded p-1 hover:bg-accent hover:text-foreground"><Maximize2 className="size-3.5" /></button>}
          </div>
        )}
        <div className={cn('min-h-0', fill && 'flex-1')} style={fill ? undefined : { maxHeight }}>
          <DataGridContainer className={fill ? 'h-full' : undefined}>
            <DataGridScrollArea className={fill ? 'h-full' : undefined} style={fill ? undefined : { maxHeight }}>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </div>
        <div className="border-t px-3 py-2"><DataGridPagination sizes={sizes} /></div>
      </div>
    </ReGrid>
    </div>
    {full && (
      <Dialog isOpen onOpenChange={setFull} className="!top-0 !left-0 !h-svh !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none ring-0 sm:!max-w-none">
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden p-3 pt-4">
          <p className="pr-10 text-sm font-semibold">Full table <span className="font-normal text-muted-foreground">· {rows.length.toLocaleString()} rows × {columns.length} columns</span></p>
          <div className="min-h-0 min-w-0 flex-1"><DataGrid columns={columns} rows={rows} fill expandable={false} leftAlign={leftAlign} /></div>
        </div>
      </Dialog>
    )}
    </>
  );
}
