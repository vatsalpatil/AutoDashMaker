import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, TextInput } from '@/components/ui/kit';
import { SelectField } from '@/components/common/SelectField';

export const TEST_KINDS = {
  not_null: 'Never empty',
  unique: 'No duplicates',
  accepted_values: 'Only these values',
  range: 'Number between',
  min_rows: 'At least N rows',
  custom_sql: 'Custom query (returns bad rows)',
} as const;
type Kind = keyof typeof TEST_KINDS;
const NEEDS_COLUMN: Kind[] = ['not_null', 'unique', 'accepted_values', 'range'];

export interface NewTest { kind: Kind; column_name?: string; config: Record<string, unknown>; severity: 'error' | 'warn' }

/** Pick a rule, a column and its settings; `onAdd` saves it (the server runs it once straight away). */
export function AddTestForm({ columns, onAdd, busy }: { columns: string[]; onAdd: (t: NewTest) => void; busy: boolean }) {
  const [kind, setKind] = useState<Kind>('not_null');
  const [column, setColumn] = useState(columns[0] ?? '');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [severity, setSeverity] = useState<'error' | 'warn'>('error');

  function config(): Record<string, unknown> {
    if (kind === 'accepted_values') return { values: a.split(',').map((v) => v.trim()).filter(Boolean) };
    if (kind === 'range') return { ...(a !== '' && { min: Number(a) }), ...(b !== '' && { max: Number(b) }) };
    if (kind === 'min_rows') return { rows: Number(a || 1) };
    if (kind === 'custom_sql') return { sql: a };
    return {};
  }
  const submit = () => onAdd({ kind, column_name: NEEDS_COLUMN.includes(kind) ? column : undefined, config: config(), severity });

  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:items-end">
      <SelectField label="Rule" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setA(''); setB(''); }}>
        {Object.entries(TEST_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      {NEEDS_COLUMN.includes(kind) && (
        <SelectField label="Column" value={column} onChange={(e) => setColumn(e.target.value)}>
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
      )}
      {kind === 'accepted_values' && <TextInput label="Values (comma separated)" value={a} onChange={setA} />}
      {kind === 'range' && <><TextInput label="Min" type="number" value={a} onChange={setA} /><TextInput label="Max" type="number" value={b} onChange={setB} /></>}
      {kind === 'min_rows' && <TextInput label="Rows" type="number" value={a} onChange={setA} />}
      {kind === 'custom_sql' && <TextInput label="SELECT … that returns bad rows" value={a} onChange={setA} />}
      <SelectField label="If it fails" value={severity} onChange={(e) => setSeverity(e.target.value as 'error' | 'warn')}>
        <option value="error">Roll back the refresh</option>
        <option value="warn">Just warn</option>
      </SelectField>
      <Button variant="primary" label="Add test" icon={<Plus className="size-4" />} onClick={submit} isDisabled={busy} />
    </div>
  );
}
