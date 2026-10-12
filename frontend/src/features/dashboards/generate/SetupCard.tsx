import { useEffect, useState } from 'react';
import { SelectField } from '@/components/common/SelectField';
import { Button, Card, TextArea } from '@/components/ui/kit';
import { CopyLiveData } from '@/features/sources/CopyLiveData';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { Setup } from './useGenerateSession';

interface Template { id: string; name: string; description: string; pages: string[] }

/** Step 1: which dataset, which template, any special focus. Collapses to a one-line summary once the AI is working. */
export function SetupCard({ initialDataset, locked, onStart }: { initialDataset?: string; locked: Setup | null; onStart: (s: Setup) => void }) {
  const datasetsApi = useApi<Dataset[]>('/datasets');
  const datasets = datasetsApi.data ?? [];
  const templates = useApi<Template[]>('/dashboards/ai/templates').data ?? [];
  const [datasetId, setDatasetId] = useState(initialDataset ?? '');
  const [template, setTemplate] = useState('auto');
  const [focus, setFocus] = useState('');
  useEffect(() => { if (!datasetId && datasets.length > 0) setDatasetId(datasets[0].id); }, [datasets, datasetId]);

  if (locked) {
    const ds = datasets.find((d) => d.id === locked.dataset_id);
    const tpl = templates.find((t) => t.id === locked.template);
    return (
      <Card padding={3}>
        <p className="text-sm"><span className="font-semibold">{ds?.name ?? 'Dataset'}</span> · {tpl?.name ?? locked.template}{locked.focus ? ` · “${locked.focus}”` : ''}</p>
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
        <SelectField label="Dataset" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        {datasets.find((d) => d.id === datasetId)?.remote_table && <CopyLiveData datasetId={datasetId} variant="notice" onDone={datasetsApi.reload} />}
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
        <TextArea label="Anything specific? (optional)" value={focus} onChange={setFocus} rows={2} placeholder="e.g. focus on profit by region and highlight the weakest months" />
        <div className="flex justify-end"><Button variant="primary" label="Start" onClick={() => onStart({ dataset_id: datasetId, template, focus })} isDisabled={!datasetId} /></div>
      </div>
    </Card>
  );
}
