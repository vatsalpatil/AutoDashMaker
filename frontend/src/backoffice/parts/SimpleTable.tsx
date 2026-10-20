import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface Col<T> { label: string; cell: (row: T) => ReactNode; className?: string }

/** Plain read-only table for backoffice lists; `onRow` makes rows clickable. */
export function SimpleTable<T>({ rows, cols, onRow, empty = 'Nothing here yet.' }: {
  rows: T[]; cols: Col<T>[]; onRow?: (row: T) => void; empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="py-6 text-center text-muted-foreground">{empty}</TableCell></TableRow>}
          {rows.map((r, i) => (
            <TableRow key={i} onClick={onRow && (() => onRow(r))} className={onRow ? 'cursor-pointer' : undefined}>
              {cols.map((c) => <TableCell key={c.label} className={c.className}>{c.cell(r)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
