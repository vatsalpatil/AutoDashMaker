import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useDatasetRefresh } from '@/hooks/useDatasetRefresh';
import { api } from '@/lib/api';
import type { Dataset, Source } from '@/lib/types';

/** Sources + datasets for the Data Sources page, with the actions that change them. */
export function useSources() {
  const sourcesApi = useApi<Source[]>('/sources');
  const datasetsApi = useApi<Dataset[]>('/datasets');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = () => { sourcesApi.reload(); datasetsApi.reload(); };
  // refreshes run as background jobs: the list stays usable and shows progress per dataset
  const refresher = useDatasetRefresh(() => reload());
  const refreshing = Object.fromEntries(Object.entries(refresher.state).map(([id, s]) => [id, s.running]));
  const refreshError = Object.values(refresher.state).find((s) => s.error)?.error ?? null;

  /** Run an action, surfacing a failure in `error`. */
  async function attempt(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); } catch (e) { setError((e as Error).message); }
  }

  const upload = async (file: File) => {
    setUploading(true);
    await attempt(async () => { await api.upload('/datasets/upload', file); reload(); });
    setUploading(false);
  };

  const refreshDataset = (id: string) => refresher.start(id);

  const removeDataset = async (id: string) => {
    if (confirm('Delete this dataset?')) await attempt(async () => { await api.del(`/datasets/${id}`); reload(); });
  };

  const removeSource = async (id: string) => {
    if (confirm('Delete this source?')) await attempt(async () => { await api.del(`/sources/${id}`); reload(); });
  };

  return {
    sources: sourcesApi.data, datasets: datasetsApi.data, error: error ?? refreshError ?? sourcesApi.error ?? datasetsApi.error,
    uploading, refreshing, reload, upload, refreshDataset, removeDataset, removeSource,
  };
}
