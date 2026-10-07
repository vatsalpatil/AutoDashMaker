import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Card, Collapsible, TextArea, TextInput } from '@/components/ui/kit';
import { SelectField as Select } from '@/components/common/SelectField';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Source } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FileField } from './FileField';
import { SOURCE_SCHEMAS, buildPayload, defaultValues, schemaOf, valuesFromSource, type Field } from './sourceSchemas';

type Values = Record<string, Record<string, string>>;

/** Add / edit a connection, inline on the Data Sources page. The form is rendered from SOURCE_SCHEMAS, one set of values per source type. */
export function SourcePanel({ open, editing, onClose, onSaved }: {
  open: boolean;
  editing: Source | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState('postgres');
  const [values, setValues] = useState<Values>({});
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // fresh form (or the saved source's values) every time the dialog opens
  useEffect(() => {
    if (!open) return;
    const all: Values = {};
    for (const s of SOURCE_SCHEMAS) all[s.id] = editing?.type === s.id ? valuesFromSource(s, editing) : defaultValues(s);
    setValues(all);
    setType(editing?.type ?? 'postgres');
    setTest(null);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open, editing]);

  const schema = schemaOf(type)!;
  const current = values[type] ?? {};
  const set = (key: string, v: string) => setValues((all) => ({ ...all, [type]: { ...all[type], [key]: v } }));
  const connectable = schema.fields.length > 0;

  const [runTest, testState] = useAsyncAction(async () => {
    setTest(null);
    try {
      const r = await api.post<{ ok?: boolean; detail?: string }>('/sources/test', buildPayload(schema, current, editing));
      setTest({ ok: r.ok !== false, text: r.detail ?? (r.ok === false ? 'Connection failed' : 'Connection OK') });
    } catch (e) {
      setTest({ ok: false, text: (e as Error).message });
    }
  });
  const [save, saveState] = useAsyncAction(async () => {
    const payload = buildPayload(schema, current, editing);
    if (editing) await api.patch(`/sources/${editing.id}`, payload);
    else await api.post('/sources', payload);
    onSaved();
    onClose();
  });

  const renderField = (f: Field) => {
    const common = { label: f.label, value: current[f.key] ?? '' };
    if (f.kind === 'file') return <FileField key={f.key} label={f.label} value={common.value} accept={f.accept} onChange={(v) => set(f.key, v)} />;
    if (f.kind === 'select') {
      return (
        <Select key={f.key} {...common} onChange={(e) => set(f.key, e.target.value)}>
          {f.options?.map((o) => <option key={o} value={o}>{o || 'Server default'}</option>)}
        </Select>
      );
    }
    if (f.kind === 'textarea') return <TextArea key={f.key} {...common} rows={3} onChange={(v) => set(f.key, v)} />;
    return (
      <TextInput key={f.key} {...common} type={f.kind === 'password' ? 'password' : 'text'}
        placeholder={f.kind === 'password' && editing ? '••••••' : f.placeholder} onChange={(v) => set(f.key, v)} />
    );
  };

  if (!open) return null;
  return (
    <Card padding={0}>
      <div ref={top} className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{editing ? `Edit ${editing.name}` : 'Add connection'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b pb-3">
          {SOURCE_SCHEMAS.map((s) => (
            <button key={s.id} type="button" onClick={() => setType(s.id)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                type === s.id ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-foreground hover:bg-accent')}>
              {s.label}
            </button>
          ))}
        </div>

        {schema.note && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{schema.note}</p>}
        <div className={cn(schema.grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3')}>{schema.fields.filter((f) => !f.advanced).map(renderField)}</div>
        {schema.fields.some((f) => f.advanced) && (
          <Collapsible key={`${type}-${editing?.id ?? 'new'}`} trigger="SSL / TLS (certificates for cloud databases)" defaultOpen={Boolean(editing?.config?.ssl_mode || editing?.config?.ssl_ca)}>
            <div className="grid grid-cols-2 gap-3">{schema.fields.filter((f) => f.advanced).map(renderField)}</div>
          </Collapsible>
        )}
        {schema.hint && <p className="text-xs text-muted-foreground">{schema.hint}</p>}
        {editing && schema.fields.some((f) => f.kind === 'password') && (
          <p className="-mt-2 text-xs text-muted-foreground">Leave password blank to keep stored password.</p>
        )}

        {(test || saveState.error || testState.error) && (
          <p className={cn('rounded-md p-2 text-sm', test?.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
            {test?.text ?? saveState.error ?? testState.error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          {connectable && <Button variant="secondary" label={testState.busy ? 'Testing…' : 'Test connection'} onClick={() => runTest()} isDisabled={testState.busy} />}
          {connectable && <Button variant="primary" label={editing ? 'Save changes' : 'Create'} onClick={() => save()} isDisabled={saveState.busy} />}
        </div>
      </div>
    </Card>
  );
}
