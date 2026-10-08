import { Plus, X } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Button, TextInput } from '@/components/ui/kit';
import { OPERATORS, type FilterRow, type Operator } from './metricModel';

/** "Only count rows where…" editor: column, operator, value per row. */
export function FilterRows({ rows, columns, onChange }: { rows: FilterRow[]; columns: string[]; onChange: (r: FilterRow[]) => void }) {
  const set = (i: number, patch: Partial<FilterRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_6.5rem_1fr_auto] items-end gap-2">
          <SelectField value={r.column} onChange={(e) => set(i, { column: e.target.value })} placeholder="Column">
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <SelectField value={r.op} onChange={(e) => set(i, { op: e.target.value as Operator })}>
            {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
          </SelectField>
          <TextInput value={r.value} onChange={(v: string) => set(i, { value: v })} placeholder="value" />
          <button aria-label="Remove filter" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mb-2 text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
        </div>
      ))}
      <Button size="sm" className="self-start" label="Add filter" icon={<Plus className="size-3.5" />} onClick={() => onChange([...rows, { column: columns[0] ?? '', op: '=', value: '' }])} isDisabled={columns.length === 0} />
    </div>
  );
}
