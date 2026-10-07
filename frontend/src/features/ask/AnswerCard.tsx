import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Sparkles } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { DataGrid } from '@/components/common/DataGrid';
import { Badge, Card, Tab, TabList } from '@/components/ui/kit';
import { KINDS } from '@/features/charts/chartKinds';
import { ChartView } from '@/features/charts/render/ChartView';
import { autoEncode } from '@/features/charts/templates';
import type { AnalystResponse, ChartSpec, ChartType } from '@/lib/types';
import { AnswerActions } from './AnswerActions';

const CONFIDENCE = {
  verified: ['green', 'Verified'], likely_correct: ['blue', 'Likely correct'], needs_clarification: ['warning', 'Needs clarification'],
  data_quality_concern: ['warning', 'Data quality concern'], insufficient_data: ['red', 'Insufficient data'],
} as const;

type View = 'chart' | 'table' | 'sql' | 'how';

/** The analyst's reply to one question: the answer in words, a chart, the table, the SQL and how it was produced. */
export function AnswerCard({ question, response, onFollowUp }: {
  question: string;
  response: AnalystResponse;
  onFollowUp: (q: string) => void;
}) {
  const [view, setView] = useState<View>('chart');
  const [override, setOverride] = useState<ChartSpec | null>(null);

  if (response.status === 'no_provider') {
    return (
      <Card padding={4}>
        <h3 className="font-semibold">AI provider needed</h3>
        <p className="mt-1 text-sm text-muted-foreground">{response.detail}</p>
        <Link to="/settings" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Open Settings →</Link>
      </Card>
    );
  }
  if (response.status === 'clarify' || response.status === 'not_a_query') {
    return <Card padding={4}><p className="text-sm">{response.status === 'clarify' ? <><span className="font-semibold">Quick question: </span>{response.detail}</> : response.detail}</p></Card>;
  }
  if (response.status === 'sql_error') {
    return (
      <Card padding={4}>
        <h3 className="font-semibold text-destructive">That query didn't run</h3>
        <p className="mt-1 text-sm text-muted-foreground">{response.detail}</p>
        {response.sql && <pre className="mono mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">{response.sql}</pre>}
      </Card>
    );
  }

  const { result, explanation } = response;
  if (!result) return null;
  const spec = override ?? response.chart ?? { type: 'table' as ChartType, encoding: { x: '', y: '' } };
  const conf = response.confidence ? CONFIDENCE[response.confidence] : null;
  const retype = (t: ChartType) => setOverride({ type: t, encoding: autoEncode(t, result, response.chart?.encoding), options: t === response.chart?.type ? response.chart?.options : {} });

  return (
    <Card padding={0} className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4">
        {response.summary && <p className="flex gap-2 text-[15px] leading-relaxed"><Sparkles className="mt-1 size-4 shrink-0 text-primary" /><span>{response.summary}</span></p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {conf && <Badge variant={conf[0]} label={conf[1]} />}
          <Badge variant="green" label={`${result.row_count.toLocaleString()} rows`} />
          <Badge variant="neutral" label={`${result.duration_ms} ms`} />
          {response.provenance?.tables.map((t) => <Badge key={t} variant="blue" label={t} />)}
          {(response.provenance?.warnings ?? []).map((w, i) => <Badge key={i} variant="warning" label={w} />)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y bg-muted/30 px-3 py-1.5">
        <TabList value={view} onChange={(v) => setView(v as View)} aria-label="Answer view">
          <Tab value="chart" label="Chart" /><Tab value="table" label="Table" /><Tab value="sql" label="SQL" /><Tab value="how" label="How" />
        </TabList>
        {view === 'chart' && (
          <div className="w-40">
            <SelectField aria-label="Chart type" value={spec.type} onChange={(e) => retype(e.target.value as ChartType)}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </SelectField>
          </div>
        )}
      </div>

      <div className="p-3">
        {view === 'chart' && <ChartView spec={spec} result={result} height={300} />}
        {view === 'table' && <DataGrid bare columns={result.columns} rows={result.rows} maxHeight="360px" />}
        {view === 'sql' && <pre className="mono max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{response.sql}</pre>}
        {view === 'how' && explanation && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {([['Tables', explanation.tables], ['Columns', explanation.columns], ['Calculated', explanation.calculated], ['Filtered', explanation.filters],
              ['Grouped by', explanation.grouped_by], ['Sorted by', explanation.sorted_by]] as const).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt><dd>{v.join(', ') || '—'}</dd></div>
            ))}
          </dl>
        )}
      </div>

      {response.insights && response.insights.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Lightbulb className="size-3.5 text-warning" /> Insights</div>
          <ul className="space-y-1 text-sm">
            {response.insights.map((ins, i) => <li key={i} className="flex gap-2"><Badge variant={ins.kind === 'anomaly' ? 'red' : ins.kind === 'trend' ? 'blue' : 'neutral'} label={ins.kind} /><span>{ins.text}</span></li>)}
          </ul>
        </div>
      )}

      <div className="border-t p-3"><AnswerActions question={question} response={response} /></div>

      {response.followups && response.followups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Ask next:</span>
          {response.followups.map((f) => (
            <button key={f} onClick={() => onFollowUp(f)} className="rounded-full border bg-card px-3 py-1 text-xs hover:border-primary hover:text-primary">{f}</button>
          ))}
        </div>
      )}
    </Card>
  );
}
