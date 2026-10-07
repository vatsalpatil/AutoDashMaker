import { Pin, PinOff, Settings2 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { getColumnHeaderLabel, type DataGridFeatures } from '@/components/reui/data-grid/data-grid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Row } from './dataGridColumns';

/** Columns picker for the data grid: show/hide each column, pin it to the left, or switch everything on / off at once. */
export function DataGridColumnsMenu({ table }: { table: Table<DataGridFeatures, Row> }) {
  const columns = table.getAllColumns().filter((c) => c.getCanHide());
  const shown = columns.filter((c) => c.getIsVisible()).length;
  const setAll = (visible: boolean) => columns.forEach((c) => c.toggleVisibility(visible));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm"><Settings2 className="size-3.5" /> Columns</Button>} />
      <DropdownMenuContent align="end" className="max-h-[70vh] min-w-[230px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between font-medium">
            <span>Columns <span className="font-normal text-muted-foreground">{shown}/{columns.length}</span></span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setAll(true)} disabled={shown === columns.length} className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-40">All</button>
              <button type="button" onClick={() => setAll(false)} disabled={shown === 0} className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-40">None</button>
              <button type="button" onClick={() => table.resetColumnPinning()} className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent" title="Unpin every column">Unpin</button>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((column) => {
            const pinned = column.getIsPinned() === 'start';
            return (
              <DropdownMenuCheckboxItem key={column.id} className="capitalize" checked={column.getIsVisible()}
                onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => column.toggleVisibility(!!v)}>
                <span className="min-w-0 flex-1 truncate">{getColumnHeaderLabel(column)}</span>
                {column.getCanPin() && (
                  <button type="button" aria-label={pinned ? 'Unpin column' : 'Pin column to the left'} title={pinned ? 'Unpin' : 'Pin to the left'}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); column.pin(pinned ? false : 'start'); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn('ml-2 rounded p-1 hover:bg-accent', pinned ? 'text-primary' : 'text-muted-foreground')}>
                    {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </button>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
