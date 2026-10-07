import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SelectField } from '@/components/common/SelectField';
import { Button, Card, TextArea, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset } from '@/lib/types';
import { OPERATORS } from './alertOps';

const EMPTY = { name: '', dataset_id: '', metric_sql: '', operator: 'gt', threshold: '', schedule_minutes: '60' };

/** "Create alert" card: a name, the dataset, a one-number SQL metric, a rule and a schedule. */
export function AlertForm({ datasets, onCreated }: { datasets: Dataset[]; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));
  useEffect(() => { if (!form.dataset_id && datasets.length > 0) set({ dataset_id: datasets[0].id }); }, [datasets, form.dataset_id]);

  const [create, { busy, error }] = useAsyncAction(async () => {
    await api.post('/alerts', { ...form, threshold: Number(form.threshold), schedule_minutes: Number(form.schedule_minutes) });
    set({ name: '', metric_sql: '', threshold: '' });
    onCreated();
  });

  return (
    <Card padding={4}>
      <h2 className="mb-3 font-semibold">Create alert</h2>
      <ErrorBanner message={error} />
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label="Name" value={form.name} onChange={(v) => set({ name: v })} placeholder="e.g. Refund spike" />
        <SelectField label="Dataset" value={form.dataset_id} onChange={(e) => set({ dataset_id: e.target.value })}>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        <div className="md:col-span-2">
          <TextArea label="Metric SQL" value={form.metric_sql} onChange={(v) => set({ metric_sql: v })} rows={2}
            placeholder="SELECT COUNT(*) FROM ds_sample_sales WHERE status='refunded'" />
          <p className="mt-1 text-xs text-muted-foreground">A single SELECT returning one numeric value.</p>
        </div>
        <SelectField label="Operator" value={form.operator} onChange={(e) => set({ operator: e.target.value })}>
          {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Threshold" value={form.threshold} onChange={(v) => set({ threshold: v })} placeholder="e.g. 100" />
          <TextInput label="Schedule (minutes)" value={form.schedule_minutes} onChange={(v) => set({ schedule_minutes: v })} placeholder="60" />
        </div>
      </div>
      <div className="mt-4">
        <Button variant="primary" label={busy ? 'Creating…' : 'Create alert'} onClick={() => create()}
          isDisabled={busy || !form.name.trim() || !form.dataset_id || !form.metric_sql.trim() || !form.threshold} />
      </div>
    </Card>
  );
}
