import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, TextInput } from '@/components/ui/kit';
import type { ActivityRow } from '../types';
import { ActivityTable } from '../parts/ActivityTable';

export function ActivityPage() {
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState(false);
  const qs = new URLSearchParams({ limit: '500', ...(q && { q }), ...(errors && { status: 'error' }) });
  const state = useApi<ActivityRow[]>(`/admin/activity?${qs}`);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Activity" description="Every API request, newest first."
        actions={<>
          <TextInput value={q} onChange={setQ} placeholder="Filter path, email, IP…" className="w-64" />
          <Button size="sm" variant={errors ? 'primary' : 'secondary'} label="Errors only" onClick={() => setErrors(!errors)} />
          <Button size="sm" label="Refresh" onClick={state.reload} />
        </>} />
      <AsyncView state={state}>{(rows) => <ActivityTable rows={rows} />}</AsyncView>
    </div>
  );
}
