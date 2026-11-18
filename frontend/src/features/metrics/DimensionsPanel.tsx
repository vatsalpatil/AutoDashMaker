import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Badge, Button, Card, EmptyState, TextInput } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset, DimensionSuggestion, SemanticDimension } from '@/lib/types';

/** Dimensions = the ways you slice a metric (Region, Month…). Pick the column; the friendly name is what people will say. */
export function DimensionsPanel({ dimensions, suggestions, datasets, onChanged }: {
  dimensions: SemanticDimension[]; suggestions: DimensionSuggestion[]; datasets: Dataset[]; onChanged: () => void;
}) {
  const [datasetId, setDatasetId] = useState('');
  const [column, setColumn] = useState('');
  const [label, setLabel] = useState('');
  const dsId = datasetId || datasets[0]?.id || '';
  const columns = useApi<Dataset>(dsId ? `/datasets/${dsId}` : null).data?.columns ?? [];
  const name = (id?: string) => datasets.find((d) => d.id === id)?.name ?? '';

  const [add, { busy }] = useAsyncAction(async (d: { dataset_id: string; column_name: string; label: string }) => {
    await api.post('/semantic/dimensions', { name: d.column_name, ...d });
    setColumn(''); setLabel(''); onChanged();
  });
  const [remove] = useAsyncAction(async (id: string) => { await api.del(`/semantic/dimensions/${id}`); onChanged(); });

  return (
    <div className="flex flex-col gap-4">
      <Card padding={3}>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <SelectField label="Dataset" value={dsId} onChange={(e) => { setDatasetId(e.target.value); setColumn(''); }}>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <SelectField label="Column" value={column} onChange={(e) => { setColumn(e.target.value); setLabel(label || e.target.value.replace(/_/g, ' ')); }} placeholder="Choose a column">
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </SelectField>
          <TextInput label="Friendly name" value={label} onChange={setLabel} placeholder="Region" />
          <Button variant="primary" label="Add" icon={<Plus className="size-4" />} isDisabled={busy || !column || !label.trim()} onClick={() => add({ dataset_id: dsId, column_name: column, label: label.trim() })} />
        </div>
      </Card>

      {dimensions.length === 0 ? <EmptyState title="No dimensions yet" description="Add one above, or start from a suggestion below." isCompact /> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dimensions.map((d) => (
            <Card key={d.id} padding={3} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{d.label}</div>
                <code className="mono text-xs text-muted-foreground">{name(d.dataset_id) && `${name(d.dataset_id)}.`}{d.column_name}</code>
              </div>
              <button aria-label={`Delete ${d.label}`} onClick={() => remove(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </Card>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Suggested from your columns</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={`${s.dataset_id}-${s.column_name}`} disabled={busy} onClick={() => add({ dataset_id: s.dataset_id, column_name: s.column_name, label: s.label })}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary" title={s.description}>
                <Plus className="size-3.5" />{s.label}<Badge label={s.dataset_name} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
