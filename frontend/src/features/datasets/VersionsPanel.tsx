import { useState } from 'react';
import { History, RotateCcw, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { Button } from '@/components/ui/kit';
import { DataGrid } from '@/components/common/DataGrid';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import type { PreviewResult } from '@/lib/types';
import { countLabel } from '@/lib/utils';

interface Version { version: string; created_at: string; bytes: number }
interface VersionList { versions: Version[]; keep: number }

/** Time travel: every refresh keeps the previous copy; look at one and roll back if a refresh went wrong. */
export function VersionsPanel({ datasetId, onRestored }: { datasetId: string; onRestored: () => void }) {
  const list = useApi<VersionList>(`/datasets/${datasetId}/versions`);
  const [peek, setPeek] = useState<{ v: string; data: PreviewResult } | null>(null);
  const [show, showState] = useAsyncAction(async (v: string) => {
    setPeek({ v, data: await api.get<PreviewResult>(`/datasets/${datasetId}/versions/${v}/preview`) });
  });
  const [restore, restoreState] = useAsyncAction(async (v: string) => {
    if (!window.confirm('Replace the current data with this version? The current data is kept as a version, so you can undo this.')) return;
    await api.post(`/datasets/${datasetId}/versions/${v}/restore`);
    setPeek(null);
    list.reload();
    onRestored();
  });

  if (list.loading) return <Loading compact />;
  if (list.error) return <ErrorBanner message={list.error} />;
  const versions = list.data?.versions ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" /> Each refresh keeps the previous copy (the last {list.data?.keep}).
      </p>
      <ErrorBanner message={showState.error || restoreState.error} />
      {versions.length === 0 && <p className="text-sm text-muted-foreground">No earlier versions yet. One is saved the next time this dataset refreshes.</p>}
      <ul className="divide-y rounded-lg border">
        {versions.map((v) => (
          <li key={v.version} className="flex items-center justify-between gap-2 p-3 text-sm">
            <span>{new Date(v.created_at).toLocaleString()} <span className="text-muted-foreground">· {(v.bytes / 1024).toFixed(0)} KB</span></span>
            <span className="flex gap-2">
              <Button variant="secondary" label="Look" icon={<Eye className="size-4" />} onClick={() => show(v.version)} isDisabled={showState.busy} />
              <Button variant="secondary" label="Restore" icon={<RotateCcw className="size-4" />} onClick={() => restore(v.version)} isDisabled={restoreState.busy} />
            </span>
          </li>
        ))}
      </ul>
      {peek && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{new Date(versions.find((v) => v.version === peek.v)?.created_at ?? '').toLocaleString()} · {countLabel(peek.data.row_count, 'row')}</p>
          <DataGrid columns={peek.data.columns} rows={peek.data.rows} />
        </div>
      )}
    </div>
  );
}
