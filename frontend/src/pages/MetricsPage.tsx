import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { RelationshipsPanel } from '@/components/RelationshipsPanel';
import { Button, EmptyState, Tab, TabList } from '@/components/ui/kit';
import { DimensionsPanel } from '@/features/metrics/DimensionsPanel';
import { GlossaryPanel } from '@/features/metrics/GlossaryPanel';
import { MetricBuilder } from '@/features/metrics/MetricBuilder';
import { MetricCard } from '@/features/metrics/MetricCard';
import { SuggestedMetrics } from '@/features/metrics/SuggestedMetrics';
import { useMetricsData } from '@/features/metrics/useMetricsData';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { sendToAsk } from '@/lib/askHandoff';
import type { MetricSuggestion } from '@/lib/types';

const TABS = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'relationships', label: 'Relationships' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** The semantic layer as a working surface: define a number once, see it live, and have Ask, charts and alerts reuse it. */
export default function MetricsPage() {
  const d = useMetricsData();
  const nav = useNavigate();
  const [stored, setTab] = useLocalStorage<TabId>('metrics.tab', 'metrics');
  const tab: TabId = TABS.some((t) => t.id === stored) ? stored : 'metrics';
  const [builder, setBuilder] = useState<{ open: boolean; seed: MetricSuggestion | null }>({ open: false, seed: null });
  const dsName = (id?: string) => d.datasets.find((x) => x.id === id)?.name;

  const [addSuggested, { busy, error: addError }] = useAsyncAction(async (s: MetricSuggestion) => {
    await api.post('/semantic/metrics', { name: s.name, label: s.label, expression: s.expression, filters: [], description: s.description, dataset_id: s.dataset_id });
    d.reload();
  });
  const [remove] = useAsyncAction(async (id: string, label: string) => {
    if (!confirm(`Delete the metric “${label}”?`)) return;
    await api.del(`/semantic/metrics/${id}`);
    d.reload();
  });
  const counts: Record<TabId, number> = { metrics: d.metrics.length, dimensions: d.dimensions.length, glossary: d.definitions.length + d.synonyms.length, relationships: d.relationships.length };

  if (d.loading) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define a number once. Ask, charts, dashboards and alerts all use the same calculation, so everyone sees the same answer.</p>
        </div>
        <Button variant="primary" label="New metric" icon={<Plus className="size-4" />} onClick={() => setBuilder({ open: true, seed: null })} isDisabled={d.datasets.length === 0} />
      </div>
      <ErrorBanner message={d.error ?? addError} />

      <TabList value={tab} onChange={(v) => setTab(v as TabId)} aria-label="Metrics sections">
        {TABS.map((t) => <Tab key={t.id} value={t.id} label={`${t.label} · ${counts[t.id]}`} />)}
      </TabList>

      {tab === 'metrics' && (
        <>
          {d.datasets.length === 0 ? <EmptyState title="Add data first" description="Metrics are calculated from a dataset." isCompact /> : d.metrics.length === 0 ? (
            <EmptyState title="No metrics yet" description="Pick from the suggestions below, or build your own with a live preview." isCompact />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {d.metrics.map((m) => (
                <MetricCard key={m.id} metric={m} value={d.values[m.id]} datasetName={dsName(m.dataset_id)}
                  onAsk={() => { sendToAsk(`What is ${m.label}, and how has it changed over time?`); nav('/ask'); }}
                  onDelete={() => remove(m.id, m.label)} />
              ))}
            </div>
          )}
          <SuggestedMetrics items={d.suggestions.metrics} busy={busy} onAdd={(s) => addSuggested(s)} onEdit={(s) => setBuilder({ open: true, seed: s })} />
        </>
      )}
      {tab === 'dimensions' && <DimensionsPanel dimensions={d.dimensions} suggestions={d.suggestions.dimensions} datasets={d.datasets} onChanged={d.reload} />}
      {tab === 'glossary' && <GlossaryPanel definitions={d.definitions} synonyms={d.synonyms} onChanged={d.reload} />}
      {tab === 'relationships' && <RelationshipsPanel datasets={d.datasets} />}

      <MetricBuilder open={builder.open} seed={builder.seed} datasets={d.datasets} onClose={() => setBuilder((b) => ({ ...b, open: false }))} onSaved={d.reload} />
    </div>
  );
}
