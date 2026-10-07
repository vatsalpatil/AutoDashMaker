import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Check, Copy, DatabaseZap, FlaskConical } from 'lucide-react';
import { DataGrid } from '@/components/common/DataGrid';
import { CodeEditor } from '@/components/common/CodeEditor';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, EmptyState, Spinner, Tab, TabList, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ChartView } from '@/features/charts/render/ChartView';
import { autoEncode } from '@/features/charts/templates';
import { columnKinds } from '@/features/charts/chartData';
import { rememberSpec } from './qbHandoff';
import { appendNotebookCell } from '@/features/workbench/notebookModel';
import { api } from '@/lib/api';
import type { QbSpec } from './qbModel';
import type { Chart, ChartSpec, ChartType, Dataset, QueryResult } from '@/lib/types';

/** A first-guess chart for a result: time/text + numbers → line/bar, otherwise a table. */
function guessSpec(r: QueryResult): ChartSpec {
  const { numeric, other } = columnKinds(r);
  const first = r.rows[0]?.[other[0]];
  const type: ChartType = !numeric.length || !other.length ? 'table' : typeof first === 'string' && /^\d{4}-\d\d/.test(first) ? 'line' : 'bar';
  return { type, encoding: autoEncode(type, r) };
}

/** Results of the builder: table, chart, SQL, with the follow-up actions (save chart / dataset, open in Workbench). */
export function ResultPane({ result, sql, spec: builtSpec, hint, running, baseDatasetId, previewAt }: {
  result: QueryResult | null; sql: string; spec: QbSpec | null; hint: string | null; running: boolean; baseDatasetId?: string; previewAt: number | null;
}) {
  const nav = useNavigate();
  const [tab, setTab] = useState('table');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const spec = useMemo(() => (result ? guessSpec(result) : null), [result]);
  const label = name.trim() || 'Query builder result';

  const [toChart, chart] = useAsyncAction(async () => {
    const q = await api.post<QueryResult>('/queries/run', { sql, name: label, save: true });
    const c = await api.post<Chart>('/charts', { name: label, query_id: q.query_id, spec: spec ?? { type: 'table', encoding: { x: '', y: '' } } });
    nav(`/charts/${c.id}`);
  });
  const [toDataset, dataset] = useAsyncAction(async () => {
    if (!baseDatasetId) throw new Error('Pick a table first');
    const d = await api.post<Dataset>('/transforms/derive', { name: label, base_dataset_id: baseDatasetId, layers: [{ type: 'sql', sql }] });
    nav(`/datasets/${d.id}`);
  });
  const copy = () => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TabList value={tab} onChange={setTab} aria-label="Result view"><Tab value="table" label="Table" /><Tab value="chart" label="Chart" /><Tab value="sql" label="SQL" /></TabList>
        {result && <span className="text-xs text-muted-foreground">{result.row_count.toLocaleString()} rows · {result.duration_ms} ms{result.cached ? ' · cached' : ''}{previewAt != null ? ` · preview of stage ${previewAt + 1}` : ''}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} label="Copy SQL" isDisabled={!sql} onClick={copy} />
          <Button size="sm" variant="outline" icon={<FlaskConical className="size-4" />} label="Workbench" isDisabled={!sql} onClick={() => { if (builtSpec) rememberSpec(sql, builtSpec); appendNotebookCell(sql); nav('/workbench'); }} />
        </span>
      </div>
      {hint && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{hint}</p>}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {running && result && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px]"><Spinner /></div>}
        {!result ? (running ? <div className="flex h-full items-center justify-center"><Spinner /></div> : <EmptyState title="Your results appear here" description="Pick a table on the left, then add steps. The result updates as you build." />)
          : tab === 'table' ? <DataGrid columns={result.columns} rows={result.rows} fill />
          : tab === 'chart' ? (spec && <div className="h-full overflow-auto"><ChartView spec={spec} result={result} height={380} /></div>)
          : <div className="h-full overflow-auto"><CodeEditor value={sql} language="sql" readOnly minHeight="12rem" /></div>}
      </div>
      {result && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <TextInput value={name} onChange={setName} placeholder="Name for chart / dataset" className="w-64" aria-label="Name" />
          <Button size="sm" variant="primary" icon={<BarChart3 className="size-4" />} label="Create chart" isDisabled={chart.busy} onClick={() => toChart()} />
          <Button size="sm" variant="outline" icon={<DatabaseZap className="size-4" />} label="Save as dataset" isDisabled={dataset.busy || !baseDatasetId} onClick={() => toDataset()} />
          {(chart.error || dataset.error) && <ErrorBanner message={chart.error || dataset.error || ''} />}
        </div>
      )}
    </div>
  );
}
