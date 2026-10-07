import { useEffect, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/common/SelectField';
import { api } from '@/lib/api';
import { OP_LABEL, UNARY_OPS, kindOf, opsFor, refKey, type ColOpt, type Kind, type QbFilter } from './qbModel';
import { ColSelect, Row, patchAt, removeAt } from './ui';

/** Value input; for text columns of a real table it offers the most common values as suggestions. */
function ValueInput({ value, onChange, kind, col, placeholder }: { value: unknown; onChange: (v: string) => void; kind: Kind; col?: ColOpt; placeholder?: string }) {
  const id = useId();
  const [hints, setHints] = useState<string[]>([]);
  useEffect(() => {
    setHints([]);
    if (!col?.table || kind !== 'text') return;
    let live = true;
    api.post<{ values: { value: unknown }[] }>('/qb/values', { table: col.table, column: col.column, limit: 30 })
      .then((r) => live && setHints(r.values.map((v) => String(v.value ?? '')).filter(Boolean))).catch(() => {});
    return () => { live = false; };
  }, [col?.table, col?.column, kind]);
  const type = kind === 'num' ? 'number' : kind === 'time' ? 'date' : 'text';
  return (
    <>
      <Input list={hints.length ? id : undefined} type={type} value={value == null ? '' : String(value)} placeholder={placeholder ?? 'value'}
        onChange={(e) => onChange(e.target.value)} className="h-8" />
      {hints.length > 0 && <datalist id={id}>{hints.map((h) => <option key={h} value={h} />)}</datalist>}
    </>
  );
}

function FilterRow({ f, cols, onChange, onRemove }: { f: QbFilter; cols: ColOpt[]; onChange: (p: Partial<QbFilter>) => void; onRemove: () => void }) {
  const col = cols.find((c) => c.key === refKey(f.col));
  const kind = col?.kind ?? kindOf('');
  const ops = opsFor(kind);
  const num = (v: string) => (kind === 'num' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
  return (
    <Row onRemove={onRemove}>
      <ColSelect cols={cols} value={f.col} onChange={(c) => onChange({ col: c.ref, op: opsFor(c.kind).includes(f.op) ? f.op : opsFor(c.kind)[0] })} />
      <SelectField value={f.op} aria-label="Operator" onChange={(e) => onChange({ op: e.target.value })}>
        {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </SelectField>
      {!UNARY_OPS.has(f.op) && (
        <ValueInput value={f.value} kind={f.op === 'expr' ? 'text' : kind} col={col} onChange={(v) => onChange({ value: f.op === 'in' || f.op === 'not_in' ? v : num(v) })}
          placeholder={f.op === 'in' || f.op === 'not_in' ? 'a, b, c' : f.op === 'expr' ? 'amount > 10 AND region = \'N\'' : f.op === 'last_n_days' || f.op === 'next_n_days' ? '30' : 'value'} />
      )}
      {f.op === 'between' && <ValueInput value={f.value2} kind={kind} col={col} onChange={(v) => onChange({ value2: num(v) })} placeholder="and" />}
    </Row>
  );
}

/** Add / edit / remove filter conditions. Used for row filters, summary filters and conditional aggregates. */
export function FilterEditor({ filters = [], cols, onChange, addLabel = 'Add filter' }: {
  filters?: QbFilter[]; cols: ColOpt[]; onChange: (f: QbFilter[]) => void; addLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {filters.map((f, i) => (
        <FilterRow key={i} f={f} cols={cols} onChange={(p) => onChange(patchAt(filters, i, p))} onRemove={() => onChange(removeAt(filters, i))} />
      ))}
      <div><Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label={addLabel} isDisabled={!cols.length}
        onClick={() => onChange([...filters, { col: cols[0]?.ref, op: opsFor(cols[0]?.kind ?? 'text')[0] }])} /></div>
    </div>
  );
}
