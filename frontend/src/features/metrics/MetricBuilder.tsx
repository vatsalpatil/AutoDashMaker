import { useEffect, useMemo, useState } from 'react';
import { SelectField } from '@/components/common/SelectField';
import { Button, Dialog, TextInput } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset, MetricSuggestion, MetricValue } from '@/lib/types';
import { FilterRows } from './FilterRows';
import { Sparkline } from './Sparkline';
import { AGGREGATES, buildExpression, buildFilter, formatValue, isNumericType, slug, type AggregateId, type FilterRow } from './metricModel';

/** Guided metric builder: pick what to measure, see the real number (and its trend) before saving. */
export function MetricBuilder({ open, datasets, seed, onClose, onSaved }: {
  open: boolean; datasets: Dataset[]; seed?: MetricSuggestion | null; onClose: () => void; onSaved: () => void;
}) {
  const [datasetId, setDatasetId] = useState('');
  const [agg, setAgg] = useState<AggregateId>('SUM');
  const [column, setColumn] = useState('');
  const [custom, setCustom] = useState('');
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<MetricValue | null>(null);

  useEffect(() => {
    if (!open) return;
    setFilters([]); setPreview(null); setColumn(''); setLabel(seed?.label ?? ''); setDescription(seed?.description ?? '');
    setDatasetId(seed?.dataset_id ?? datasets[0]?.id ?? '');
    setAgg(seed ? 'CUSTOM' : 'SUM'); setCustom(seed?.expression ?? '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset once per opening, not whenever the lists reload

  const cols = useApi<Dataset>(open && datasetId ? `/datasets/${datasetId}` : null).data?.columns ?? [];
  const usable = useMemo(() => (AGGREGATES.find((a) => a.id === agg)?.numericOnly ? cols.filter((c) => isNumericType(c.dtype ?? c.type)) : cols), [cols, agg]);
  const expression = buildExpression(agg, column, custom);
  const conditions = filters.map(buildFilter).filter(Boolean);
  const needsColumn = agg !== 'COUNT' && agg !== 'CUSTOM';

  useEffect(() => { // live preview, debounced
    if (!open || !datasetId || !expression) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.post<MetricValue>('/semantic/metrics/preview', { dataset_id: datasetId, expression, filters: conditions }).then(setPreview).catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [open, datasetId, expression, conditions.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const [save, { busy, error }] = useAsyncAction(async () => {
    await api.post('/semantic/metrics', { name: slug(label), label: label.trim(), expression, filters: conditions, description, dataset_id: datasetId });
    onSaved(); onClose();
  });
  const ok = !!preview && !preview.error && label.trim() !== '' && expression !== '';

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[34rem] max-w-full flex-col gap-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">New metric</h2>
          <p className="text-sm text-muted-foreground">Define a number once. Ask, charts and alerts then use this exact calculation.</p>
        </div>
        <SelectField label="Measure from" value={datasetId} onChange={(e) => { setDatasetId(e.target.value); setColumn(''); setFilters([]); }}>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Calculation" value={agg} onChange={(e) => { setAgg(e.target.value as AggregateId); setColumn(''); }}>
            {AGGREGATES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </SelectField>
          {needsColumn && (
            <SelectField label="Of column" value={column} onChange={(e) => setColumn(e.target.value)} placeholder="Choose a column">
              {usable.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </SelectField>
          )}
        </div>
        {agg === 'CUSTOM' && <TextInput label="SQL aggregate" value={custom} onChange={setCustom} placeholder='SUM("amount") - SUM("refunds")' />}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Only rows where <span className="font-normal text-muted-foreground">(optional)</span></span>
          <FilterRows rows={filters} columns={cols.map((c) => c.name)} onChange={setFilters} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Name" value={label} onChange={setLabel} placeholder="Net revenue" />
          <TextInput label="Description" value={description} onChange={setDescription} placeholder="What it means" />
        </div>
        <div className="rounded-lg border bg-muted/30 p-3" aria-live="polite">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</div>
          {!preview ? <p className="text-sm text-muted-foreground">Choose what to measure to see the number.</p>
            : preview.error ? <p className="text-sm text-destructive">{preview.error}</p>
            : <div className="flex items-center gap-4"><span className="text-3xl font-bold tabular-nums">{formatValue(preview.value)}</span><div className="min-w-0 flex-1"><Sparkline values={preview.trend.map((t) => t.value)} /></div></div>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button label="Cancel" onClick={onClose} />
          <Button variant="primary" label={busy ? 'Saving…' : 'Save metric'} onClick={() => save()} isDisabled={!ok || busy} />
        </div>
      </div>
    </Dialog>
  );
}
