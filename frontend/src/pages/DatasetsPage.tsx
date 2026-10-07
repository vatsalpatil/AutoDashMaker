import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState } from '@/components/ui/kit';
import { UploadCloud, GitMerge } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { BlendDialog } from '@/components/BlendDialog';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [blendOpen, setBlendOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.get<Dataset[]>('/datasets').then(setDatasets).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await api.upload('/datasets/upload', file);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!datasets) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Datasets</h1>
        <Button
          variant="secondary"
          label="Blend datasets"
          icon={<GitMerge className="h-4 w-4" />}
          onClick={() => setBlendOpen(true)}
          isDisabled={datasets.length < 2}
        />
      </div>
      <ErrorBanner message={error} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-sm transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-input text-muted-foreground hover:border-blue-400'
        }`}
      >
        <UploadCloud className="h-8 w-8" />
        {uploading ? 'Uploading…' : 'Drag a CSV/Parquet file here, or click to browse'}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </div>

      {datasets.length === 0 ? (
        <EmptyState title="No datasets yet" description="Upload a file above or ingest from a source to get started." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((d) => (
            <Link key={d.id} to={`/datasets/${d.id}`}>
              <Card padding={3}>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{d.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.kind && <Badge variant="neutral" label={d.kind} />}
                  {d.row_count !== undefined && <Badge variant="blue" label={`${d.row_count.toLocaleString()} rows`} />}
                  {d.columns && <Badge variant="neutral" label={`${d.columns.length} columns`} />}
                  {d.created_at && <Badge variant="neutral" label={new Date(d.created_at).toLocaleDateString()} />}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <BlendDialog isOpen={blendOpen} onClose={() => setBlendOpen(false)} datasets={datasets} />
    </div>
  );
}
