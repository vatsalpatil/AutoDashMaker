import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Check, Copy, FlaskConical, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { appendNotebookCell } from '@/features/workbench/notebookModel';
import { api } from '@/lib/api';
import type { AnalystResponse, Chart, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';

const REASONS = ['wrong_metric', 'wrong_table', 'wrong_filter', 'wrong_time', 'wrong_interpretation', 'other'];

/** Everything you can do with an answer: save it as a chart (opens the studio), continue in the Workbench, copy, rate. */
export function AnswerActions({ question, response }: { question: string; response: AnalystResponse }) {
  const nav = useNavigate();
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [reasons, setReasons] = useState(false);
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const sql = response.sql ?? '';

  const rate = async (v: 'correct' | 'incorrect', reason = '') => {
    await api.post('/semantic/feedback', { question, sql, verdict: v, reason }).catch(() => {});
    setVerdict(v);
    setReasons(false);
  };

  const toStudio = async () => {
    setBusy(true);
    try {
      const q = await api.post<QueryResult>('/queries/run', { sql, name: question.slice(0, 80), save: true });
      const chart = await api.post<Chart>('/charts', { name: question.slice(0, 80), query_id: q.query_id, spec: response.chart ?? { type: 'table', encoding: { x: '', y: '' } } });
      nav(`/charts/${chart.id}`);
    } finally {
      setBusy(false);
    }
  };

  const toWorkbench = () => { appendNotebookCell(sql); nav('/workbench'); };
  const copy = () => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const pill = (active: boolean, tone: string) => cn('gap-1', active && tone);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" icon={<BarChart3 className="size-4" />} label="Create chart" isDisabled={busy} onClick={toStudio} />
        <Button size="sm" variant="outline" icon={<FlaskConical className="size-4" />} label="Open in Workbench" onClick={toWorkbench} />
        <Button size="sm" variant="ghost" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} label="Copy SQL" onClick={copy} />
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Correct" className={pill(verdict === 'correct', 'text-success')} icon={<ThumbsUp className="size-4" />} onClick={() => rate('correct')} />
          <Button size="sm" variant="ghost" aria-label="Incorrect" className={pill(verdict === 'incorrect', 'text-destructive')} icon={<ThumbsDown className="size-4" />} onClick={() => setReasons((s) => !s)} />
          <Button size="sm" variant="ghost" isDisabled={verified} className={pill(verified, 'text-success')} icon={<ShieldCheck className="size-4" />} label={verified ? 'In verified library' : 'Verify'}
            onClick={async () => { await api.post('/semantic/verified', { question, sql }).catch(() => {}); setVerified(true); }} />
        </span>
      </div>
      {reasons && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-2">
          <span className="text-xs text-muted-foreground">What was wrong?</span>
          {REASONS.map((r) => (
            <button key={r} onClick={() => rate('incorrect', r)} className="rounded-full border bg-card px-2.5 py-0.5 text-xs hover:bg-accent">{r.replace('wrong_', '').replace('_', ' ')}</button>
          ))}
        </div>
      )}
    </div>
  );
}
