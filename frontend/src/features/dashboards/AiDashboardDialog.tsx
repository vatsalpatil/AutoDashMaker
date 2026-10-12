import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Button, Dialog, TextArea } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';
import { AiRunLog } from './ai/AiRunLog';
import { useAiRun } from './ai/useAiRun';
import type { ReviewCheck } from './ai/ReviewChecklist';
import { ResultCard } from './generate/ResultCard';

interface CreateDone {
  dashboard_id: string;
  name: string;
  widgets: { id: string; title: string; type: string }[];
  skipped: { title: string; reason: string }[];
  score: number;
  checks: ReviewCheck[];
  suggestions: string[];
}

const STEPS = ['Reading your data', 'Designing the dashboard', 'Building and checking each widget', 'Self-review and corrections', 'Writing insights', 'Saving the dashboard'];

const EXAMPLES = [
  'Executive overview: headline KPIs, a trend over time and the top categories',
  'Compare regions: revenue by region, share of total and the best and worst performers',
  'Data health: row counts, missing values and the biggest groups',
];

const DEPTH: Record<string, string> = {
  auto: '',
  executive: 'Keep it executive: 4 to 6 widgets, the headline numbers and one trend.',
  analyst: 'Make it detailed for an analyst: 8 to 10 widgets with breakdowns, comparisons and a detail table.',
};

/** Describe a dashboard in words; the AI designs, builds, checks, self-corrects and scores it, live, before anything is saved. */
export function AiDashboardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const datasets = useApi<Dataset[]>(open ? '/datasets' : null).data ?? [];
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('');
  const [depth, setDepth] = useState('auto');
  const run = useAiRun<CreateDone>();
  const started = run.busy || run.steps.length > 0;

  const build = () => run.run('/api/dashboards/ai/create/stream',
    { prompt: [prompt.trim(), DEPTH[depth]].filter(Boolean).join('\n'), dataset_id: scope || undefined });
  const restart = () => run.reset();
  const done = run.done;

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && !run.busy && onClose()}>
      <div className="flex max-h-[90svh] w-[40rem] max-w-full flex-col gap-3 overflow-y-auto p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5 text-primary" /> Create a dashboard with AI</h2>
          <p className="text-sm text-muted-foreground">The AI designs it, runs and checks every query, fixes what does not fit, scores the result and writes insights. You watch every step.</p>
        </div>
        {!started && (
          <>
            <TextArea label="What should the dashboard show?" value={prompt} onChange={setPrompt} rows={4}
              placeholder="e.g. Sales performance: total revenue and profit KPIs, monthly trend, top 10 products and revenue by country" />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setPrompt(e)} className="rounded-full border bg-card px-2.5 py-1 text-left text-xs hover:border-primary hover:text-primary">{e}</button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Data" value={scope || 'all'} onChange={(e) => setScope(e.target.value === 'all' ? '' : e.target.value)}>
                <option value="all">All tables &amp; saved queries</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectField>
              <SelectField label="Detail" value={depth} onChange={(e) => setDepth(e.target.value)}>
                <option value="auto">Let the AI decide</option>
                <option value="executive">Executive (4–6 widgets)</option>
                <option value="analyst">Analyst (8–10 widgets)</option>
              </SelectField>
            </div>
          </>
        )}
        {started && <p className="rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Request:</span> {prompt}</p>}

        <AiRunLog run={run} titles={STEPS} />

        {run.error && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {run.error.message}
            {run.error.noProvider && <> <Link to="/settings" className="underline">Open Settings</Link></>}
          </p>
        )}
        {done && (
          <ResultCard onRestart={restart}
            result={{ ...done, pages: ['Overview'], widgets: done.widgets.map((w) => ({ ...w, page: 'Overview' })), score: undefined }} />
        )}

        <div className="mt-1 flex justify-end gap-2">
          {run.busy && <Button variant="ghost" label="Stop" onClick={run.stop} />}
          {!run.busy && <Button variant="ghost" label="Close" onClick={onClose} />}
          {!run.busy && !done && started && <Button variant="secondary" label="Change request" onClick={restart} />}
          {!started && <Button variant="primary" icon={<Sparkles className="size-4" />} label="Build dashboard" onClick={build} isDisabled={!prompt.trim()} />}
          {!run.busy && !done && started && <Button variant="primary" label="Try again" onClick={build} />}
        </div>
      </div>
    </Dialog>
  );
}
