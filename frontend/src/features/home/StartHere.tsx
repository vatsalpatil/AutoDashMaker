import { Link, useNavigate } from 'react-router-dom';
import { Database, Globe } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { UploadDropzone } from '@/components/common/UploadDropzone';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset } from '@/lib/types';

/** First-run card for an empty workspace: the fastest way to get a first dataset in. */
export function StartHere() {
  const nav = useNavigate();
  const [upload, { busy, error }] = useAsyncAction(async (file: File) => {
    const ds = await api.upload<Dataset>('/datasets/upload', file);
    nav(`/datasets/${ds.id}`);
  });
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Start with your data</h2>
        <p className="text-sm text-muted-foreground">Drop a file and you can ask questions about it in seconds.</p>
      </div>
      <ErrorBanner message={error} />
      <UploadDropzone onFile={upload} busy={busy} title="Drag a CSV, Parquet, Excel or JSON file here" busyTitle="Uploading and reading your data…" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>Or connect:</span>
        <Link to="/sources" className="inline-flex items-center gap-1 hover:text-primary"><Database className="size-3.5" /> a database</Link>
        <Link to="/sources/studio" className="inline-flex items-center gap-1 hover:text-primary"><Globe className="size-3.5" /> an API or URL</Link>
      </div>
    </section>
  );
}
