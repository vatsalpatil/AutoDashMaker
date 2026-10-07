import { useState } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, Card, TextArea, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';

const EMPTY = { name: '', sql: '', schedule_minutes: '1440', webhook_url: '' };

/** "Create report" card: a name, any read-only SELECT, how often to run it and an optional webhook. */
export function ReportForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));
  const [create, { busy, error }] = useAsyncAction(async () => {
    await api.post('/reports', { ...form, schedule_minutes: Number(form.schedule_minutes) });
    setForm(EMPTY);
    onCreated();
  });
  return (
    <Card padding={4}>
      <h2 className="mb-3 font-semibold">Create report</h2>
      <ErrorBanner message={error} />
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label="Name" value={form.name} onChange={(v) => set({ name: v })} placeholder="e.g. Weekly revenue by region" />
        <TextInput label="Run every (minutes)" value={form.schedule_minutes} onChange={(v) => set({ schedule_minutes: v })} placeholder="1440 = daily, 10080 = weekly" />
        <div className="md:col-span-2">
          <TextArea label="Query" value={form.sql} onChange={(v) => set({ sql: v })} rows={3} placeholder="SELECT region, SUM(amount) AS revenue FROM ds_sample_sales GROUP BY region" />
        </div>
        <div className="md:col-span-2">
          <TextInput label="Webhook (optional)" value={form.webhook_url} onChange={(v) => set({ webhook_url: v })} placeholder="https://hooks.slack.com/… — receives a summary after each run" />
        </div>
      </div>
      <div className="mt-4">
        <Button variant="primary" label={busy ? 'Creating…' : 'Create report'} onClick={() => create()}
          isDisabled={busy || !form.name.trim() || !form.sql.trim() || !Number(form.schedule_minutes)} />
      </div>
    </Card>
  );
}
