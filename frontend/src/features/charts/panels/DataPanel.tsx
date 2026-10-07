import { SelectField } from '@/components/common/SelectField';
import { Label } from '@/components/ui/label';
import type { ChartEncoding, ChartSpec, ChartType, SavedQuery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { KINDS, kindOf } from '../chartKinds';

const NONE = '__none__';

/** Query picker, chart-type grid and the column → role mapping (X, measures, split, size). */
export function DataPanel({ queries, queryId, onQuery, columns, spec, onType, onEncoding }: {
  queries: SavedQuery[];
  queryId: string;
  onQuery: (id: string) => void;
  columns: string[];
  spec: ChartSpec;
  onType: (t: ChartType) => void;
  onEncoding: (patch: Partial<ChartEncoding>) => void;
}) {
  const kind = kindOf(spec.type);
  const e = spec.encoding;
  const measures = e.ys?.length ? e.ys : [e.y].filter(Boolean);
  const toggleMeasure = (c: string) => {
    const next = measures.includes(c) ? measures.filter((m) => m !== c) : [...measures, c];
    if (next.length > 0) onEncoding({ ys: next, y: next[0] });
  };
  const colOptions = columns.map((c) => <option key={c} value={c}>{c}</option>);
  const optional = (v?: string) => (v && columns.includes(v) ? v : NONE);

  return (
    <div className="flex flex-col gap-5 p-3">
      <SelectField label="Data (saved query)" value={queryId} onChange={(ev) => onQuery(ev.target.value)} placeholder="Choose a query…">
        {queries.map((q) => <option key={q.id} value={String(q.id)}>{q.name}</option>)}
      </SelectField>

      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground">Chart type</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => onType(k.id)} aria-pressed={spec.type === k.id}
              className={cn('flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors hover:bg-accent',
                spec.type === k.id ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}>
              <k.icon className="size-4" />
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {columns.length === 0 && queryId === '' && <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Pick a query to see its columns.</p>}

      {columns.length > 0 && kind.family !== 'table' && (
        <div className="flex flex-col gap-3">
          <SelectField label={kind.roles.x} value={columns.includes(e.x) ? e.x : ''} onChange={(ev) => onEncoding({ x: ev.target.value })}>{colOptions}</SelectField>

          {kind.multiMeasure ? (
            <div className="flex flex-col gap-1.5">
              <Label className="font-normal text-muted-foreground">{kind.roles.y}</Label>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <button key={c} type="button" onClick={() => toggleMeasure(c)} aria-pressed={measures.includes(c)}
                    className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      measures.includes(c) ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <SelectField label={kind.roles.y} value={columns.includes(e.y) ? e.y : ''} onChange={(ev) => onEncoding({ y: ev.target.value, ys: undefined })}>{colOptions}</SelectField>
          )}

          {kind.roles.color && (
            <SelectField label={kind.roles.color} value={optional(e.color)} onChange={(ev) => onEncoding({ color: ev.target.value === NONE ? undefined : ev.target.value })}>
              <option value={NONE}>None</option>
              {colOptions}
            </SelectField>
          )}
          {kind.roles.size && (
            <SelectField label={kind.roles.size} value={optional(e.size)} onChange={(ev) => onEncoding({ size: ev.target.value === NONE ? undefined : ev.target.value })}>
              <option value={NONE}>None</option>
              {colOptions}
            </SelectField>
          )}
        </div>
      )}
    </div>
  );
}
