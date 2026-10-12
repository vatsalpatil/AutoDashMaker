import { DatabaseZap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { useCopyDataset } from './useCopyDataset';

/** For a live-linked table: copy its rows into the app so charts and dashboards read local data (fast, and no timeouts). */
export function CopyLiveData({ datasetId, variant, onDone }: { datasetId: string; variant: 'button' | 'notice'; onDone: () => void }) {
  const copy = useCopyDataset(datasetId, onDone);
  const label = copy.busy ? 'Copying…' : copy.state === 'error' ? 'Try copying again' : 'Copy data into the app';
  const action = <Button variant={variant === 'notice' ? 'primary' : 'secondary'} label={label} icon={copy.busy ? <Loader2 className="size-4 animate-spin" /> : <DatabaseZap className="size-4" />} onClick={copy.start} isDisabled={copy.busy} />;
  if (variant === 'button') return action;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold">This dataset is a live link to your database.</span> Every chart on a dashboard would read the whole remote table, which is slow and often times out.
        Copy the data into the app first{copy.busy ? ' (a big table can take a few minutes; you can leave this page)' : ''}.
        {copy.error && <span className="mt-1 block text-destructive">{copy.error}</span>}
      </p>
      {action}
    </div>
  );
}
