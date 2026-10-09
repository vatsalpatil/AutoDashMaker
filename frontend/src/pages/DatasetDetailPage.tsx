import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Tab, TabList } from '@/components/ui/kit';
import { Link2, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset, DatasetSchema, GenerateResponse, PreviewResult, QualityRun } from '@/lib/types';
import { DataGrid } from '@/components/common/DataGrid';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { SchemaGrid } from '@/components/SchemaGrid';
import { FreshnessStrip } from '@/components/FreshnessStrip';
import { WhyPanel } from '@/components/WhyPanel';
import { TransformPanel } from '@/components/TransformPanel';
import { QualityBadge } from '@/pages/QualityBadge';

export default function DatasetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [quality, setQuality] = useState<QualityRun | null>(null);
  const [tab, setTab] = useState('schema');
  const [error, setError] = useState<string | null>(null);
  const [runningQ, setRunningQ] = useState(false);
  const [generating, setGenerating] = useState(false);
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
    loadQuality();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function generateDashboard() {
    setGenerating(true);
    setError(null);
    try {
      const r = await api.post<GenerateResponse>('/dashboards/generate', { dataset_id: id });
      navigate(`/dashboards/${r.dashboard_id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  const loadQuality = useCallback(() => {
    api.get<QualityRun>(`/quality/dataset/${id}`).then(setQuality).catch(() => setQuality(null));
  }, [id]);
  useEffect(loadQuality, [loadQuality]);

  async function runQuality() {
    setRunningQ(true);
    try {
      await api.post(`/quality/run/${id}`);
      loadQuality();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunningQ(false);
    }
  }

  if (!dataset) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name}</h1>
          <div className="mt-1 flex gap-2">
            {dataset.kind && <Badge variant="neutral" label={dataset.kind} />}
            {schema && <Badge variant="blue" label={`${schema.row_count.toLocaleString()} rows`} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!dataset.remote_table && dataset.source_id && ["mysql", "postgres", "sqlite"].includes(dataset.kind ?? "") && (
            <Button variant="secondary" label={linking ? "Switching…" : "Keep only stats"} icon={<Link2 className="h-4 w-4" />} onClick={keepOnlyStats} isDisabled={linking} />
          )}
        <Button
          variant="primary"
          label={generating ? 'Generating…' : 'Generate dashboard'}
          icon={<Wand2 className="h-4 w-4" />}
          onClick={generateDashboard}
          isDisabled={generating}
        />
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

      {tab === 'quality' && (
        <Card padding={4}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Data quality</h3>
            <Button variant="primary" label={runningQ ? 'Running…' : 'Run check'} onClick={runQuality} isDisabled={runningQ} />
          </div>
          {!quality ? (
            <p className="mt-3 text-sm text-muted-foreground">No quality run yet for this dataset.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {(['completeness', 'uniqueness', 'validity'] as const).map((k) => (
                <div key={k} className="rounded-lg border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">{k}</div>
                  <div className="mt-1">
                    <QualityBadge value={quality[k]} />
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Duplicates</div>
                <div className="mt-1 text-lg font-semibold">{quality.duplicate_pct ?? '—'}%</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Freshness</div>
                <div className="mt-1 text-lg font-semibold">{String(quality.freshness ?? '—')}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Rows</div>
                <div className="mt-1 text-lg font-semibold">{quality.row_count?.toLocaleString() ?? '—'}</div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
