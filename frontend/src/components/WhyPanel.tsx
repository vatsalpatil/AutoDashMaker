import { useEffect, useState } from 'react';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { api } from '@/lib/api';
import type { DatasetSchema, WhyResponse } from '@/lib/types';
import { SelectField as Select } from '@/components/common/SelectField';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';

const NUMERIC = /INT|FLOAT|DOUBLE|NUMERIC|DECIMAL|REAL|BIGINT|SMALLINT/i;
const TEMPORAL = /DATE|TIME/i;

export function WhyPanel({ datasetId }: { datasetId: string }) {
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [dateCol, setDateCol] = useState('');
  const [metricCol, setMetricCol] = useState('');
  const [days, setDays] = useState('30');
  const [agg, setAgg] = useState('SUM');
  const [result, setResult] = useState<WhyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<DatasetSchema>(`/datasets/${datasetId}/schema`).then((s) => {
      setSchema(s);
      const temporal = s.columns.filter((c) => TEMPORAL.test(c.dtype));
      const numeric = s.columns.filter((c) => NUMERIC.test(c.dtype));
      setDateCol((temporal[0] ?? s.columns[0])?.name ?? '');
      setMetricCol((numeric[0] ?? s.columns[0])?.name ?? '');
    }).catch((e) => setError(e.message));
  }, [datasetId]);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.post<WhyResponse>('/why', {
        dataset_id: datasetId,
        date_column: dateCol,
        metric_column: metricCol,
        days: Number(days),
        agg,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!schema) return <Loading compact />;

  const cols = [...schema.columns].sort((a, b) => {
    const score = (dt: string, re: RegExp) => (re.test(dt) ? 0 : 1);
    return score(a.dtype, TEMPORAL) - score(b.dtype, TEMPORAL);
  });
  const numericFirst = [...schema.columns].sort((a, b) => {
    const score = (dt: string) => (NUMERIC.test(dt) ? 0 : 1);
    return score(a.dtype) - score(b.dtype);
  });

  const dirIcon = result?.direction === 'up' ? (
    <ArrowUp className="h-5 w-5 text-success" />
  ) : result?.direction === 'down' ? (
    <ArrowDown className="h-5 w-5 text-destructive" />
  ) : (
    <ArrowRight className="h-5 w-5 text-muted-foreground/70" />
  );

  return (
    <div className="flex flex-col gap-4">
      <Card padding={4}>
        <h3 className="mb-3 font-semibold">Why did a metric change?</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Select label="Date column" value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
            {cols.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
            ))}
          </Select>
          <Select label="Metric column" value={metricCol} onChange={(e) => setMetricCol(e.target.value)}>
            {numericFirst.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
            ))}
          </Select>
          <TextInput label="Days" value={days} onChange={setDays} placeholder="30" />
          <Select label="Aggregation" value={agg} onChange={(e) => setAgg(e.target.value)}>
            {['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
          <Button variant="primary" label={busy ? 'Analysing…' : 'Run'} onClick={run} isDisabled={busy || !dateCol || !metricCol} />
        </div>
      </Card>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {result && (
        <>
          <Card padding={4}>
            <div className="flex items-center gap-3">
              {dirIcon}
              <div>
                <div className="text-lg font-semibold">
                  {result.metric}: {result.current.toLocaleString()} vs {result.previous.toLocaleString()}{' '}
                  <span className={result.direction === 'up' ? 'text-success' : result.direction === 'down' ? 'text-destructive' : ''}>
                    ({result.delta >= 0 ? '+' : ''}{result.delta.toLocaleString()}, {result.delta_pct >= 0 ? '+' : ''}{result.delta_pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.period.current} <span className="text-muted-foreground/70">vs</span> {result.period.previous}
                </div>
              </div>
            </div>
            {result.headline && (
              <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                {result.headline}
              </p>
            )}
          </Card>

          {result.breakdowns.map((b) => (
            <Card key={b.dimension} padding={4}>
              <h3 className="mb-3 font-semibold">By {b.dimension}</h3>
              <div className="overflow-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {['Value', 'Current', 'Previous', 'Δ', 'Share'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {b.contributors.map((c) => (
                      <tr key={c.value}>
                        <td className="px-3 py-1.5 font-medium">{c.value}</td>
                        <td className="px-3 py-1.5">{c.current.toLocaleString()}</td>
                        <td className="px-3 py-1.5">{c.previous.toLocaleString()}</td>
                        <td className={`px-3 py-1.5 ${c.delta > 0 ? 'text-success' : c.delta < 0 ? 'text-destructive' : ''}`}>
                          {c.delta >= 0 ? '+' : ''}{c.delta.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-sm bg-accent">
                              <div
                                className="h-2 rounded-sm bg-blue-500"
                                style={{ width: `${Math.min(Math.abs(c.share_pct), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{c.share_pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
          {result.caveat && (
            <p className="text-sm text-muted-foreground">Note: {result.caveat}</p>
          )}
        </>
      )}
    </div>
  );
}
