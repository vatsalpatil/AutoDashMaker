import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { Button, Dialog, TextArea } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { Dataset } from '@/lib/types';

interface CreateResult {
  status: 'ok' | 'no_provider' | 'failed';
  detail?: string;
  dashboard_id?: string;
  name?: string;
  widgets?: { id: string; title: string; type: string }[];
  skipped?: { title: string; reason: string }[];
}

const EXAMPLES = [
  'Executive overview: headline KPIs, a trend over time and the top categories',
  'Compare regions: revenue by region, share of total and the best and worst performers',
  'Data health: row counts, missing values and the biggest groups',
];

/** Describe a dashboard in words; the AI proposes widgets, every query is checked and run before anything is saved. */
export function AiDashboardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const datasets = useApi<Dataset[]>(open ? '/datasets' : null).data ?? [];
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [build, { busy, error }] = useAsyncAction(async () => {
    setResult(null);
    const r = await api.post<CreateResult>('/dashboards/ai/create', { prompt, dataset_id: scope || undefined });
    setResult(r);
    if (r.status === 'ok' && r.dashboard_id && !r.skipped?.length) navigate(`/dashboards/${r.dashboard_id}`);
  });

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <div className="flex w-[34rem] max-w-full flex-col gap-3 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5 text-primary" /> Create a dashboard with AI</h2>
          <p className="text-sm text-muted-foreground">Describe what you want to see. You can refine it afterwards by chatting with the dashboard.</p>
        </div>
        <TextArea label="What should the dashboard show?" value={prompt} onChange={setPrompt} rows={4}
          placeholder="e.g. Sales performance: total revenue and profit KPIs, monthly trend, top 10 products and revenue by country" />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setPrompt(e)} className="rounded-full border bg-card px-2.5 py-1 text-left text-xs hover:border-primary hover:text-primary">{e}</button>)}
        </div>
        <SelectField label="Data" value={scope || 'all'} onChange={(e) => setScope(e.target.value === 'all' ? '' : e.target.value)}>
          <option value="all">All tables &amp; saved queries</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>

        {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Designing widgets and checking every query… {elapsed}s</p>}
        {(error || result?.status === 'failed' || result?.status === 'no_provider') && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {error ?? result?.detail}
            {result?.status === 'no_provider' && <> <Link to="/settings" className="underline">Open Settings</Link></>}
          </p>
        )}
        {result?.status === 'ok' && result.skipped && result.skipped.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
            <p className="font-medium">Created “{result.name}” with {result.widgets?.length} widgets. {result.skipped.length} could not be built:</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{result.skipped.map((s) => <li key={s.title}><b>{s.title}</b>: {s.reason}</li>)}</ul>
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" label="Close" onClick={onClose} isDisabled={busy} />
          {result?.status === 'ok' && result.dashboard_id
            ? <Button variant="primary" label="Open dashboard" onClick={() => navigate(`/dashboards/${result.dashboard_id}`)} />
            : <Button variant="primary" icon={<Sparkles className="size-4" />} label={busy ? 'Building…' : 'Build dashboard'} onClick={() => build()} isDisabled={busy || !prompt.trim()} />}
        </div>
      </div>
    </Dialog>
  );
}
