import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, TextInput, TextArea } from '@/components/ui/kit';
import { Trash2, Plus, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset, Relationship, SemanticDefinition, SemanticDimension, SemanticMetric, SemanticSynonym } from '@/lib/types';
import { SelectField as Select } from '@/components/common/SelectField';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { RelationshipsPanel } from '@/components/RelationshipsPanel';

type Tab = 'metrics' | 'dimensions' | 'definitions' | 'synonyms' | 'relationships';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'metrics', label: 'Metrics', hint: 'Governed calculations, e.g. Net Revenue = SUM(amount) WHERE status = completed' },
  { id: 'dimensions', label: 'Dimensions', hint: 'Business-friendly names for grouping columns, e.g. Region → region' },
  { id: 'definitions', label: 'Definitions', hint: 'Plain-English business rules, e.g. "Active customer = ≥1 completed order in period"' },
  { id: 'synonyms', label: 'Synonyms', hint: 'Term mappings so "sales" means "net_revenue"' },
  { id: 'relationships', label: 'Relationships', hint: 'Declare join keys between datasets for blending and the AI' },
];

export default function MetricsPage() {
  const [tab, setTab] = useState<Tab>('metrics');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [metrics, setMetrics] = useState<SemanticMetric[]>([]);
  const [dimensions, setDimensions] = useState<SemanticDimension[]>([]);
  const [definitions, setDefinitions] = useState<SemanticDefinition[]>([]);
  const [synonyms, setSynonyms] = useState<SemanticSynonym[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<Dataset[]>('/datasets').then((ds) => {
      setDatasets(ds);
      if (ds.length > 0) setDatasetId(String(ds[0].id));
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    api.get<SemanticMetric[]>('/semantic/metrics').then(setMetrics).catch((e) => setError(e.message));
    api.get<SemanticDimension[]>('/semantic/dimensions').then(setDimensions).catch(() => {});
    api.get<SemanticDefinition[]>('/semantic/definitions').then(setDefinitions).catch(() => {});
    api.get<SemanticSynonym[]>('/semantic/synonyms').then(setSynonyms).catch(() => {});
    api.get<Relationship[]>('/transforms/relationships').then(setRelationships).catch(() => {});
  }, []);
  useEffect(load, [load]);

  function field(key: string) {
    return form[key] ?? '';
  }
  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function create() {
    setError(null);
    try {
      if (tab === 'metrics') {
        await api.post('/semantic/metrics', {
          name: field('name'), label: field('label'), expression: field('expression'),
          filters: field('filters') ? [field('filters')] : [],
          description: field('description'), dataset_id: datasetId || undefined,
        });
      } else if (tab === 'dimensions') {
        await api.post('/semantic/dimensions', {
          name: field('name'), label: field('label'), column_name: field('column_name'),
          description: field('description'), dataset_id: datasetId || undefined,
        });
      } else if (tab === 'definitions') {
        await api.post('/semantic/definitions', { term: field('term'), definition: field('definition') });
      } else {
        await api.post('/semantic/synonyms', { term: field('term'), maps_to: field('maps_to') });
      }
      setForm({});
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(entity: Tab, id: string) {
    await api.del(`/semantic/${entity}/${id}`).catch((e) => setError(e.message));
    load();
  }

  const counts: Record<Tab, number> = {
    metrics: metrics.length,
    dimensions: dimensions.length,
    definitions: definitions.length,
    synonyms: synonyms.length,
    relationships: relationships.length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Semantic Layer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teach the AI your business language once — every answer then uses your definitions, not guesses.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setShowForm(false); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent '}`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
        {tab !== 'relationships' && (
          <div className="ml-auto flex items-center gap-2">
            <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Button variant="primary" label="Add" icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm((s) => !s)} />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{TABS.find((t) => t.id === tab)?.hint}</p>

      {showForm && (
        <Card padding={4}>
          <div className="flex flex-col gap-3">
            {tab === 'metrics' && (
              <>
                <TextInput label="Name (snake_case)" value={field('name')} onChange={(v: string) => set('name', v)} placeholder="net_revenue" />
                <TextInput label="Label" value={field('label')} onChange={(v: string) => set('label', v)} placeholder="Net Revenue" />
                <TextInput label="Expression (SQL)" value={field('expression')} onChange={(v: string) => set('expression', v)} placeholder="SUM(amount)" />
                <TextInput label="Filter (optional)" value={field('filters')} onChange={(v: string) => set('filters', v)} placeholder="status = 'completed'" />
                <TextInput label="Description" value={field('description')} onChange={(v: string) => set('description', v)} placeholder="Revenue excluding refunds" />
              </>
            )}
            {tab === 'dimensions' && (
              <>
                <TextInput label="Name" value={field('name')} onChange={(v: string) => set('name', v)} placeholder="region" />
                <TextInput label="Label" value={field('label')} onChange={(v: string) => set('label', v)} placeholder="Region" />
                <TextInput label="Column" value={field('column_name')} onChange={(v: string) => set('column_name', v)} placeholder="region" />
                <TextInput label="Description" value={field('description')} onChange={(v: string) => set('description', v)} />
              </>
            )}
            {tab === 'definitions' && (
              <>
                <TextInput label="Term" value={field('term')} onChange={(v: string) => set('term', v)} placeholder="Active customer" />
                <TextArea label="Definition" value={field('definition')} onChange={(v: string) => set('definition', v)} rows={2} placeholder="A customer with at least one completed order in the selected period" />
              </>
            )}
            {tab === 'synonyms' && (
              <>
                <TextInput label="Term" value={field('term')} onChange={(v: string) => set('term', v)} placeholder="sales" />
                <TextInput label="Maps to" value={field('maps_to')} onChange={(v: string) => set('maps_to', v)} placeholder="net_revenue" />
              </>
            )}
            <div className="flex gap-2">
              <Button variant="primary" label="Save" onClick={create} />
              <Button variant="secondary" label="Cancel" onClick={() => setShowForm(false)} />
            </div>
          </div>
        </Card>
      )}

      {tab === 'metrics' && (
        metrics.length === 0 ? <EmptyState title="No metrics yet" description="Define your first governed metric." isCompact /> :
        <div className="grid gap-3 md:grid-cols-2">
          {metrics.map((m) => (
            <Card key={m.id} padding={3}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.label}</span>
                    <Badge variant="neutral" label={m.name} />
                  </div>
                  <code className="mono mt-1 block text-xs text-blue-700 dark:text-blue-300">
                    {m.expression}{m.filters?.length > 0 && ` WHERE ${m.filters.join(' AND ')}`}
                  </code>
                  {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                </div>
                <button onClick={() => remove('metrics', m.id)} className="text-muted-foreground/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'dimensions' && (
        dimensions.length === 0 ? <EmptyState title="No dimensions yet" isCompact /> :
        <div className="grid gap-3 md:grid-cols-2">
          {dimensions.map((d) => (
            <Card key={d.id} padding={3}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold">{d.label}</span>
                  <code className="mono ml-2 text-xs text-blue-700 dark:text-blue-300">→ {d.column_name}</code>
                  {d.description && <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>}
                </div>
                <button onClick={() => remove('dimensions', d.id)} className="text-muted-foreground/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'definitions' && (
        definitions.length === 0 ? <EmptyState title="No definitions yet" isCompact /> :
        <div className="flex flex-col gap-2">
          {definitions.map((d) => (
            <Card key={d.id} padding={3}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 text-muted-foreground/70" />
                  <div>
                    <span className="font-semibold">{d.term}</span>
                    <p className="text-sm text-muted-foreground">{d.definition}</p>
                  </div>
                </div>
                <button onClick={() => remove('definitions', d.id)} className="text-muted-foreground/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'relationships' && <RelationshipsPanel datasets={datasets} />}

      {tab === 'synonyms' && (
        synonyms.length === 0 ? <EmptyState title="No synonyms yet" isCompact /> :
        <div className="flex flex-wrap gap-2">
          {synonyms.map((s) => (
            <span key={s.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
              {s.term} <span className="text-muted-foreground/70">=</span> <code className="mono text-blue-700 dark:text-blue-300">{s.maps_to}</code>
              <button onClick={() => remove('synonyms', s.id)} className="text-muted-foreground/70 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
