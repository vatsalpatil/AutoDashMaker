import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Button, Dialog, TextArea } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GenerationTimeline, STEP_TITLES } from './GenerationTimeline';
import { useGenerateDashboard } from './useGenerateDashboard';

interface Template { id: string; name: string; description: string; pages: string[] }

/** Pick a dataset + template; the AI reads the data and builds a multi-page dashboard while showing every step. */
export function GenerateDashboardDialog({ open, onClose }: { open: boolean; onClose: () => void; onError?: (m: string) => void }) {
  const navigate = useNavigate();
  const datasets = useApi<Dataset[]>(open ? '/datasets' : null).data ?? [];
  const templates = useApi<Template[]>(open ? '/dashboards/ai/templates' : null).data ?? [];
  const [datasetId, setDatasetId] = useState('');
  const [template, setTemplate] = useState('auto');
  const [focus, setFocus] = useState('');
  const gen = useGenerateDashboard();
  useEffect(() => { if (!datasetId && datasets.length > 0) setDatasetId(datasets[0].id); }, [datasets, datasetId]);
  useEffect(() => { if (!open) gen.reset(); }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  const started = gen.steps.length > 0 || gen.busy || !!gen.error;
  const doneCount = gen.steps.filter((x) => x.done).length;
  const close = () => { if (gen.busy) gen.stop(); onClose(); };

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && close()}>
      <div className="flex max-h-[85vh] w-[40rem] max-w-full flex-col gap-3 overflow-y-auto p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="relative flex size-6 items-center justify-center">
              {gen.busy && <span className="gen-ring absolute inset-0 rounded-full bg-primary/40" />}
              <Sparkles className={cn('relative size-5 text-primary', gen.busy && 'animate-pulse')} />
            </span>
            {gen.busy ? 'The AI is building your dashboard…' : gen.result ? 'Your dashboard is ready' : 'Generate dashboard with AI'}
          </h2>
          <p className="text-sm text-muted-foreground">The AI reads your data, works out what it means, then builds a multi-page dashboard with checked queries, KPIs, charts, tables and insights.</p>
        </div>

        {!started && (<>
          <SelectField label="Dataset" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)}
                className={cn('rounded-lg border p-2.5 text-left transition-colors', template === t.id ? 'border-primary bg-primary/10' : 'hover:bg-accent')}>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
                {t.pages.length > 0 && <span className="mt-1 block text-xs text-primary">{t.pages.join(' · ')}</span>}
              </button>
            ))}
          </div>
          <TextArea label="Anything specific? (optional)" value={focus} onChange={setFocus} rows={2} placeholder="e.g. focus on profit by region and highlight the weakest months" />
        </>)}

        {started && !gen.error && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STEP_TITLES.length} aria-valuenow={doneCount}>
            <div className="relative h-full overflow-hidden rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.max(4, (doneCount / STEP_TITLES.length) * 100)}%` }}>
              {gen.busy && <span className="gen-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
            </div>
          </div>
        )}
        {started && <GenerationTimeline steps={gen.steps} widgets={gen.widgets} busy={gen.busy} />}

        {gen.error && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {gen.error.noProvider ? <>No AI provider is set up. Add one in <Link to="/settings" className="underline" onClick={onClose}>Settings</Link> to generate dashboards.</> : gen.error.message}
          </p>
        )}
        {gen.result && (
          <div className="animate-in zoom-in-95 fade-in rounded-lg border border-success/40 bg-success/10 p-3 text-sm duration-300">
            <p className="font-semibold text-success">“{gen.result.name}” is ready</p>
            <p className="text-muted-foreground">{gen.result.widgets.length} widgets across {gen.result.pages.join(', ')}.</p>
          </div>
        )}
        {gen.result?.skipped.length ? <p className="text-xs text-muted-foreground">{gen.result.skipped.length} widget(s) were skipped because their queries did not pass the checks.</p> : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="secondary" label={gen.busy ? 'Stop' : gen.result ? 'Close' : 'Cancel'} onClick={close} />
          {!started && <Button variant="primary" label="Generate" onClick={() => gen.start({ dataset_id: datasetId, template, focus })} isDisabled={!datasetId} />}
          {gen.error && <Button variant="primary" label="Try again" onClick={() => gen.reset()} />}
          {gen.result && <Button variant="primary" label="Open dashboard" onClick={() => { onClose(); navigate(`/dashboards/${gen.result!.dashboard_id}`); }} />}
        </div>
      </div>
    </Dialog>
  );
}
