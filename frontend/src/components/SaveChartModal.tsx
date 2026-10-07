import { useState } from 'react';
import { Dialog, Button, TextInput } from '@/components/ui/kit';
import { api } from '@/lib/api';
import type { Chart, ChartType, QueryResult } from '@/lib/types';
import { SelectField as Select } from '@/components/common/SelectField';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { KINDS } from '@/features/charts/chartKinds';
import { autoEncode } from '@/features/charts/templates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: QueryResult;
  onSaved?: (chart: Chart) => void;
}


export function SaveChartModal({ isOpen, onClose, result, onSaved }: Props) {
  const [name, setName] = useState('Untitled chart');
  const [type, setType] = useState<ChartType>('bar');
  const [x, setX] = useState(result.columns[0] ?? '');
  const [y, setY] = useState(result.columns[1] ?? result.columns[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Persist the query first, then create a chart bound to it.
      const q = await api.post<QueryResult>('/queries/run', { sql: result.sql, name, save: true });
      const chart = await api.post<Chart>('/charts', {
        name,
        query_id: q.query_id,
        spec: { type, encoding: { ...autoEncode(type, result), x, y } },
      });
      onSaved?.(chart);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <div className="flex w-[28rem] max-w-full flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Save as chart</h2>
        <ErrorBanner message={error} />
        <TextInput label="Chart name" value={name} onChange={(v) => setName(v)} />
        <Select label="Chart type" value={type} onChange={(e) => { const t = e.target.value as ChartType; setType(t); const enc = autoEncode(t, result); setX(enc.x); setY(enc.y); }}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </Select>
        <Select label="X column" value={x} onChange={(e) => setX(e.target.value)}>
          {result.columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select label="Y column" value={y} onChange={(e) => setY(e.target.value)}>
          {result.columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button variant="primary" label={busy ? 'Saving…' : 'Save chart'} onClick={save} isDisabled={busy || !name || !x || !y} />
        </div>
      </div>
    </Dialog>
  );
}
