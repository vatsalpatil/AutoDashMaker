import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DatasetPicker } from './DatasetPicker';
import { Button, Card, TextArea } from '@/components/ui/kit';
import { CopyLiveData } from '@/features/sources/CopyLiveData';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { Setup } from './useGenerateSession';

interface Template { id: string; name: string; description: string; pages: string[] }

/** Step 1: which dataset, which template, any special focus. Collapses to a one-line summary once the AI is working. */
export function SetupCard({ initialDataset, locked, onStart, onDraft }: { initialDataset?: string; locked: Setup | null; onStart: (s: Setup) => void; onDraft?: (s: Setup) => void }) {
  const datasetsApi = useApi<Dataset[]>('/datasets');
  const datasets = datasetsApi.data ?? [];
  const templates = useApi<Template[]>('/dashboards/ai/templates').data ?? [];
  const [picked, setPicked] = useState<string[]>(initialDataset ? [initialDataset] : []);
  const datasetId = picked[0] ?? '';
  const setup = (): Setup => ({ dataset_id: datasetId, dataset_ids: picked.length > 1 ? picked : undefined, template, focus });
  const [template, setTemplate] = useState('auto');
  const [focus, setFocus] = useState('');
  // pick the first dataset when none is chosen or the chosen one no longer exists (e.g. an old ?dataset= link)
  useEffect(() => {
    const valid = picked.filter((id) => datasets.some((d) => d.id === id));
    if (datasets.length > 0 && valid.length !== picked.length || (datasets.length > 0 && valid.length === 0)) setPicked(valid.length ? valid : [datasets[0].id]);
  }, [datasets, picked]);
  useEffect(() => { onDraft?.(setup()); }, [onDraft, picked, template, focus]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (locked && onDraft) return null;   // in the chat, the choice shows as your message instead
  if (locked) {
    const ids = locked.dataset_ids ?? [locked.dataset_id];
    const names = ids.map((id) => datasets.find((d) => d.id === id)?.name ?? 'Dataset').join(' + ');
    const tpl = templates.find((t) => t.id === locked.template);
    return (
      <Card padding={3}>
        <p className="text-sm"><span className="font-semibold">{names}</span> · {tpl?.name ?? locked.template}{locked.focus ? ` · “${locked.focus}”` : ''}</p>
      </Card>
    );
  }
  return (
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">What should the AI build a dashboard from?</h2>
          <p className="text-sm text-muted-foreground">It will study the data, ask you a few questions, propose a plan for your approval, then build and check every query.</p>
        </div>
        {datasetsApi.loading ? <p className="text-sm text-muted-foreground">Loading your datasets…</p>
          : datasets.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {datasetsApi.error ? `Could not load your datasets: ${datasetsApi.error}` : 'You have no datasets yet.'}{' '}
            <Link to="/sources" className="font-medium text-primary underline">Add data</Link> first, then come back here.
          </p>
        ) : null}
        {datasets.length > 0 && <DatasetPicker datasets={datasets} value={picked} onChange={(ids) => setPicked(ids.length ? ids : picked)} />}
        {picked.length === 1 && datasets.find((d) => d.id === datasetId)?.remote_table && <CopyLiveData datasetId={datasetId} variant="notice" onDone={datasetsApi.reload} />}
        <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)}
              className={cn('rounded-lg border p-3 text-left transition-colors', template === t.id ? 'border-primary bg-primary/10' : 'hover:bg-accent')}>
              <span className="block text-sm font-medium">{t.name}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
              {t.pages.length > 0 && <span className="mt-1 block text-xs text-primary">{t.pages.join(' · ')}</span>}
            </button>
          ))}
        </div>
        {!onDraft && <>
          <TextArea label="Anything specific? (optional)" value={focus} onChange={setFocus} rows={2} placeholder="e.g. focus on profit by region and highlight the weakest months" />
          <div className="flex justify-end"><Button variant="primary" label="Start" onClick={() => onStart(setup())} isDisabled={!datasetId} /></div>
        </>}
      </div>
    </Card>
  );
}
