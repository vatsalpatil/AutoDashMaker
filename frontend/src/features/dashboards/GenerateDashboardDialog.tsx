import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SelectField } from '@/components/common/SelectField';
import { Button, Dialog } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset, GenerateResponse } from '@/lib/types';

/** Pick a dataset and get a dashboard with charts and "why" explanations built automatically. */
export function GenerateDashboardDialog({ open, onClose, onError }: { open: boolean; onClose: () => void; onError: (m: string) => void }) {
  const navigate = useNavigate();
  const datasets = useApi<Dataset[]>(open ? '/datasets' : null).data ?? [];
  const [datasetId, setDatasetId] = useState('');
  useEffect(() => { if (!datasetId && datasets.length > 0) setDatasetId(datasets[0].id); }, [datasets, datasetId]);

  const [generate, { busy, error }] = useAsyncAction(async () => {
    const r = await api.post<GenerateResponse>('/dashboards/generate', { dataset_id: datasetId });
    navigate(`/dashboards/${r.dashboard_id}`);
  });
  useEffect(() => { if (error) onError(error); }, [error, onError]);

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[24rem] max-w-full flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold">Generate dashboard</h2>
        <p className="text-sm text-muted-foreground">Pick a dataset — a dashboard with charts and why-explanations will be built automatically.</p>
        <SelectField label="Dataset" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="secondary" label="Cancel" onClick={onClose} />
          <Button variant="primary" label={busy ? 'Generating…' : 'Generate'} onClick={() => generate()} isDisabled={busy || !datasetId} />
        </div>
      </div>
    </Dialog>
  );
}
