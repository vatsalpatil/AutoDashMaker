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
import { useMetricsData } from '@/features/metrics/useMetricsData';
import { suggestionKey, useSuggestedValues } from '@/features/metrics/useSuggestedValues';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { sendToAsk } from '@/lib/askHandoff';
import type { MetricSuggestion } from '@/lib/types';

const TABS = [
  { id: 'numbers', label: 'Key numbers' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'relationships', label: 'Relationships' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Key numbers: every important number in your data, live, with its trend. Pinned ones are saved metrics that Ask uses by name. */
export default function MetricsPage() {
  const d = useMetricsData();
  const nav = useNavigate();
  const [stored, setTab] = useLocalStorage<TabId>('metrics.tab2', 'numbers');
  const tab: TabId = TABS.some((t) => t.id === stored) ? stored : 'numbers';
  const [builder, setBuilder] = useState(false);
  const dsName = (id?: string) => d.datasets.find((x) => x.id === id)?.name;
  const suggested = d.suggestions.metrics.slice(0, 12);
  const suggestedValues = useSuggestedValues(tab === 'numbers' ? suggested : []);
  const ask = (label: string) => { sendToAsk(`Why did ${label} change last month? Show the biggest drivers.`); nav('/ask'); };

  const [pin, { busy, error: pinError }] = useAsyncAction(async (s: MetricSuggestion) => {
    await api.post('/semantic/metrics', { name: s.name, label: s.label, expression: s.expression, filters: [], description: s.description, dataset_id: s.dataset_id });
    d.reload();
  });
  const [unpin] = useAsyncAction(async (id: string) => { await api.del(`/semantic/metrics/${id}`); d.reload(); });
  const counts: Record<TabId, number> = { numbers: d.metrics.length, dimensions: d.dimensions.length, glossary: d.definitions.length + d.synonyms.length, relationships: d.relationships.length };

  if (d.loading) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Key numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your most important numbers, live, with how they moved since last month. Pin the ones you track: Ask then knows them by name and always calculates them the same way.</p>
        </div>
        <Button variant="primary" label="Custom number" icon={<Plus className="size-4" />} onClick={() => setBuilder(true)} isDisabled={d.datasets.length === 0} />
      </div>
      <ErrorBanner message={d.error ?? pinError} />

      <TabList value={tab} onChange={(v) => setTab(v as TabId)} aria-label="Key numbers sections">
        {TABS.map((t) => <Tab key={t.id} value={t.id} label={t.id === 'numbers' ? t.label : `${t.label} · ${counts[t.id]}`} />)}
      </TabList>
      {tab !== 'numbers' && <p className="-mt-2 text-xs text-muted-foreground">These teach Ask your vocabulary: which columns to group by, what your terms mean and how tables connect.</p>}

      {tab === 'numbers' && (d.datasets.length === 0 ? <EmptyState title="Add data first" description="Key numbers are calculated from your datasets." isCompact /> : (
        <>
          {d.metrics.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Pinned · {d.metrics.length}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {d.metrics.map((m) => (
                  <MetricCard key={m.id} metric={m} value={d.values[m.id]} datasetName={dsName(m.dataset_id)} pinned
                    onAsk={() => ask(m.label)} onUnpin={() => unpin(m.id)} />
                ))}
              </div>
            </section>
          )}
          {suggested.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{d.metrics.length > 0 ? 'More from your data' : 'From your data'}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {suggested.map((s) => (
                  <MetricCard key={suggestionKey(s)} metric={s} value={suggestedValues[suggestionKey(s)]} datasetName={s.dataset_name} pinned={false} busy={busy}
                    onAsk={() => ask(s.label)} onPin={() => pin(s)} />
                ))}
              </div>
            </section>
          )}
        </>
      ))}
      {tab === 'dimensions' && <DimensionsPanel dimensions={d.dimensions} suggestions={d.suggestions.dimensions} datasets={d.datasets} onChanged={d.reload} />}
      {tab === 'glossary' && <GlossaryPanel definitions={d.definitions} synonyms={d.synonyms} onChanged={d.reload} />}
      {tab === 'relationships' && <RelationshipsPanel datasets={d.datasets} />}

      <MetricBuilder open={builder} seed={null} datasets={d.datasets} onClose={() => setBuilder(false)} onSaved={d.reload} />
    </div>
  );
}
