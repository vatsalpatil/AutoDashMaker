import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/kit';
import type { AnswerLineage } from '@/lib/types';
import { countLabel } from '@/lib/utils';

const list = (v?: string[]) => (v && v.length ? v.join(', ') : '');

/** Collapsible "How this was calculated" for an ok Ask answer: sources, columns, logic and run stats. */
export function LineagePanel({ lineage }: { lineage: AnswerLineage }) {
  const rows: [string, string][] = ([
    ['Tables', list(lineage.tables)],
    ['CTEs', list(lineage.ctes)],
    ['Columns', list(lineage.columns?.map((c) => `${c.table}.${c.column}`))],
    ['Joins', list(lineage.joins?.map((j) => `${j.type} ${j.table} on ${j.on}`))],
    ['Filters', list(lineage.filters)],
    ['Grouped by', list(lineage.group_by)],
    ['Aggregations', list(lineage.aggregations)],
    ['Windows', list(lineage.windows)],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <details className="group border-t px-4 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /> How this was calculated
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {lineage.row_count != null && <Badge variant="green" label={countLabel(lineage.row_count, 'row')} />}
          {lineage.execution_ms != null && <Badge variant="neutral" label={`${lineage.execution_ms} ms`} />}
          {lineage.attempts != null && lineage.attempts > 1 && <Badge variant="warning" label={`${lineage.attempts} attempts`} />}
        </div>
        {lineage.datasets && lineage.datasets.length > 0 && (
          <ul className="space-y-1">
            {lineage.datasets.map((d) => (
              <li key={d.id}>
                <Link to={`/datasets/${d.id}`} className="font-medium text-primary hover:underline">{d.name}</Link>
                <span className="text-muted-foreground"> · {d.table}{d.refreshed_at || d.updated_at ? ` · updated ${new Date((d.refreshed_at || d.updated_at)!).toLocaleString()}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {rows.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}
          </dl>
        )}
        {lineage.metrics && lineage.metrics.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metrics</div>
            <ul className="mt-1 space-y-1">
              {lineage.metrics.map((m) => (
                <li key={m.name}><span className="font-medium">{m.label || m.name}</span>{m.expression && <code className="mono ml-2 text-xs text-muted-foreground">{m.expression}</code>}</li>
              ))}
            </ul>
          </div>
        )}
        {lineage.sql && <pre className="mono max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{lineage.sql}</pre>}
      </div>
    </details>
  );
}
