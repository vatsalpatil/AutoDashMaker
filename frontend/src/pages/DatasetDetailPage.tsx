import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Tab, TabList } from '@/components/ui/kit';
import { Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset, DatasetSchema, PreviewResult } from '@/lib/types';
import { DataGrid } from '@/components/common/DataGrid';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { SchemaGrid } from '@/components/SchemaGrid';
import { FreshnessStrip } from '@/components/FreshnessStrip';
import { WhyPanel } from '@/components/WhyPanel';
import { TransformPanel } from '@/components/TransformPanel';
import { CopyLiveData } from '@/features/sources/CopyLiveData';
import { VersionsPanel } from '@/features/datasets/VersionsPanel';
import { QualityPanel } from '@/features/quality/QualityPanel';
import { countLabel } from '@/lib/utils';

export default function DatasetDetailPage() {
  const { id } = useParams();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [tab, setTab] = useState('schema');
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

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

  if (!dataset) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name}</h1>
          <div className="mt-1 flex gap-2">
            {dataset.kind && <Badge variant="neutral" label={dataset.kind} />}
            {schema && <Badge variant="blue" label={countLabel(schema.row_count, 'row')} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataset.remote_table && <CopyLiveData datasetId={dataset.id} variant="button" onDone={loadDataset} />}
          {!dataset.remote_table && dataset.source_id && ["mysql", "postgres", "sqlite"].includes(dataset.kind ?? "") && (
            <Button variant="secondary" label={linking ? "Switching…" : "Keep only stats"} icon={<Link2 className="h-4 w-4" />} onClick={keepOnlyStats} isDisabled={linking} />
          )}
        </div>
      </div>
      <ErrorBanner message={error} />

      <FreshnessStrip datasetId={id!} onRefreshed={loadDataset} />

      <TabList value={tab} onChange={setTab} aria-label="Dataset detail">
        <Tab value="schema" label="Schema" />
        <Tab value="preview" label="Preview" />
        <Tab value="quality" label="Quality" />
        <Tab value="why" label="Why?" />
        <Tab value="transform" label="Transform" />
        {!dataset.remote_table && <Tab value="versions" label="Versions" />}
      </TabList>

      {tab === 'schema' &&
        (!schema ? (
          <Loading compact />
        ) : (
          <SchemaGrid schema={schema} />
        ))}

      {tab === 'preview' &&
        (!preview ? <Loading compact /> : <DataGrid columns={preview.columns} rows={preview.rows} />)}

      {tab === 'why' && <WhyPanel datasetId={id!} />}

      {tab === 'transform' && <TransformPanel baseDataset={dataset} />}

      {tab === 'versions' && <VersionsPanel datasetId={id!} onRestored={loadDataset} />}

      {tab === 'quality' && <QualityPanel datasetId={id!} />}
    </div>
  );
}
