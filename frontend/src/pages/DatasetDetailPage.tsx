import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Tab, TabList } from '@/components/ui/kit';
import { Folder, Link2, Pencil } from 'lucide-react';
import { DatasetMetaDialog } from '@/features/datasets/DatasetMetaDialog';
import { api } from '@/lib/api';
import type { Dataset, DatasetSchema, PreviewResult } from '@/lib/types';
import { DataGrid } from '@/components/common/DataGrid';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { SchemaGrid } from '@/components/SchemaGrid';
import { FreshnessStrip } from '@/components/FreshnessStrip';
import { WhyPanel } from '@/components/WhyPanel';
import { TransformPanel } from '@/components/TransformPanel';
import { DatasetNextSteps } from '@/features/datasets/DatasetNextSteps';
import { CopyLiveData } from '@/features/sources/CopyLiveData';
import { VersionsPanel } from '@/features/datasets/VersionsPanel';
import { TestsPanel } from '@/features/datasets/TestsPanel';
import { QualityPanel } from '@/features/quality/QualityPanel';
import { countLabel } from '@/lib/utils';

export default function DatasetDetailPage() {
  const { id } = useParams();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [tab, setTab] = useState('preview');
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [renaming, setRenaming] = useState(false);

  /** Drop the stored copy of a database table; only schema + stats stay, queries run live against the source. */
  async function keepOnlyStats() {
    if (!window.confirm('Remove the stored copy and keep only the table info and stats? Queries will then run live against the source database.')) return;
    setLinking(true);
    setError(null);
    try { await api.post(`/datasets/${id}/to-linked`); loadDataset(); } catch (e) { setError((e as Error).message); } finally { setLinking(false); }
  }

  const loadDataset = useCallback(() => {
    api.get<Dataset>(`/datasets/${id}`).then(setDataset).catch((e) => setError(e.message));
    api.get<DatasetSchema>(`/datasets/${id}/schema`).then(setSchema).catch((e) => setError(e.message));
    api.get<PreviewResult>(`/datasets/${id}/preview?limit=100`).then(setPreview).catch(() => {});
  }, [id]);
  useEffect(() => {
    loadDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!dataset) return error ? <ErrorBanner message={error} /> : <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold">{dataset.name}</h1>
            <Button variant="ghost" size="sm" aria-label="Rename or move to folder" title="Rename or move to folder" icon={<Pencil className="size-4" />} onClick={() => setRenaming(true)} />
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {dataset.folder && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Folder className="size-3.5" /> {dataset.folder.split('/').join(' / ')}</span>}
            {dataset.kind && <Badge variant="neutral" label={dataset.kind} />}
            {schema && <Badge variant="blue" label={countLabel(schema.row_count, 'row')} />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetNextSteps dataset={dataset} />
          {dataset.remote_table && <CopyLiveData datasetId={dataset.id} variant="button" onDone={loadDataset} />}
          {!dataset.remote_table && dataset.source_id && ["mysql", "postgres", "sqlite"].includes(dataset.kind ?? "") && (
            <Button variant="secondary" label={linking ? "Switching…" : "Keep only stats"} icon={<Link2 className="h-4 w-4" />} onClick={keepOnlyStats} isDisabled={linking} />
          )}
        </div>
      </div>
      <ErrorBanner message={error} />
      {dataset.description && <p className="-mt-2 text-sm text-muted-foreground">{dataset.description}</p>}
      <DatasetMetaDialog open={renaming} title="Rename or move dataset" submitLabel="Save" withDescription
        hint="The new name works right away in Ask and SQL. Saved charts and dashboards keep working."
        initial={{ name: dataset.name, folder: dataset.folder ?? '', description: dataset.description ?? '' }}
        onClose={() => setRenaming(false)}
        onSubmit={async (m) => { await api.patch(`/datasets/${dataset.id}`, m); loadDataset(); }} />

      <FreshnessStrip datasetId={id!} onRefreshed={loadDataset} />

      <TabList value={tab} onChange={setTab} aria-label="Dataset detail">
        <Tab value="preview" label="Preview" />
        <Tab value="schema" label="Columns" />
        <Tab value="quality" label="Quality" />
        <Tab value="tests" label="Tests" />
        <Tab value="transform" label="Transform" />
        <Tab value="why" label="What changed" />
        {!dataset.remote_table && <Tab value="versions" label="Versions" />}
      </TabList>

      {tab === 'schema' &&
        (!schema ? (
          <Loading compact />
        ) : (
          <SchemaGrid schema={schema} />
        ))}

      {tab === 'preview' &&
        (!preview ? <Loading compact /> : <>
          <p className="text-xs text-muted-foreground">First {preview.rows.length.toLocaleString()} rows{schema ? ` of ${schema.row_count.toLocaleString()}` : ''}. Open in builder or Workbench to filter and summarize all rows.</p>
          <DataGrid columns={preview.columns} rows={preview.rows} />
        </>)}

      {tab === 'why' && <WhyPanel datasetId={id!} />}

      {tab === 'transform' && <TransformPanel baseDataset={dataset} />}

      {tab === 'tests' && <TestsPanel datasetId={id!} columns={schema?.columns.map((c) => c.name) ?? []} />}

      {tab === 'versions' && <VersionsPanel datasetId={id!} onRestored={loadDataset} />}

      {tab === 'quality' && <QualityPanel datasetId={id!} />}
    </div>
  );
}
