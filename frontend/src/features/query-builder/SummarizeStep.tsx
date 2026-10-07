import { Plus, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { SelectField } from '@/components/common/SelectField';
import { FilterEditor } from './FilterEditor';
import { AGG_FNS, BUCKETS, type ColOpt, type QbStage } from './qbModel';
import { ColSelect, NameInput, Row, Step, patchAt, removeAt } from './ui';

/** Summarize: metrics (with optional per-metric conditions) grouped by breakouts (with time/number bucketing) + a filter on the summary. */
export function SummarizeStep({ st, cols, set }: { st: QbStage; cols: ColOpt[]; set: (p: Partial<QbStage>) => void }) {
  const aggs = st.aggregations ?? [];
  const brks = st.breakouts ?? [];
  const kindOfRef = (k: string) => cols.find((c) => c.key === k)?.kind ?? 'text';
  return (
    <Step icon={<Sigma />} title="Summarize" tone="success" badge={<span className="text-xs text-muted-foreground">{aggs.length} metric{aggs.length === 1 ? '' : 's'} · {brks.length} group{brks.length === 1 ? '' : 's'}</span>}>
      <p className="text-xs font-medium text-muted-foreground">Metrics</p>
      {aggs.map((a, i) => {
        const def = AGG_FNS.find((f) => f.id === a.fn);
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <Row onRemove={() => set({ aggregations: removeAt(aggs, i) })}>
              <SelectField value={a.fn} aria-label="Metric" onChange={(e) => set({ aggregations: patchAt(aggs, i, { fn: e.target.value }) })}>
                {AGG_FNS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </SelectField>
              {def?.needsCol && <ColSelect cols={cols} value={a.col} onChange={(c) => set({ aggregations: patchAt(aggs, i, { col: c.ref }) })} />}
              {a.fn === 'expr' && <NameInput value={a.expr} placeholder="SUM(price * qty) / COUNT(*)" onChange={(v) => set({ aggregations: patchAt(aggs, i, { expr: v }) })} />}
              <NameInput value={a.as} placeholder="Name (optional)" onChange={(v) => set({ aggregations: patchAt(aggs, i, { as: v || undefined }) })} />
            </Row>
            {a.where && <div className="ml-3 border-l-2 pl-3"><FilterEditor filters={a.where} cols={cols} addLabel="Add condition" onChange={(w) => set({ aggregations: patchAt(aggs, i, { where: w.length ? w : undefined }) })} /></div>}
            {!a.where && a.fn !== 'expr' && <button className="ml-3 w-fit text-xs text-primary hover:underline" onClick={() => set({ aggregations: patchAt(aggs, i, { where: [{ op: '=', col: cols[0]?.ref }] }) })}>Only count rows where…</button>}
          </div>
        );
      })}
      <div><Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label="Add metric" onClick={() => set({ aggregations: [...aggs, { fn: aggs.length ? 'sum' : 'count' }] })} /></div>

      <p className="mt-1 text-xs font-medium text-muted-foreground">Group by</p>
      {brks.map((b, i) => {
        const k = kindOfRef(cols.find((c) => JSON.stringify(c.ref) === JSON.stringify(b.col))?.key ?? '');
        return (
          <Row key={i} onRemove={() => set({ breakouts: removeAt(brks, i) })}>
            <ColSelect cols={cols} value={b.col} onChange={(c) => set({ breakouts: patchAt(brks, i, { col: c.ref, bucket: 'none' }) })} />
            <SelectField value={b.bucket ?? 'none'} aria-label="Bucket" onChange={(e) => set({ breakouts: patchAt(brks, i, { bucket: e.target.value }) })}>
              {BUCKETS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
            <NameInput value={b.as} placeholder="Name (optional)" onChange={(v) => set({ breakouts: patchAt(brks, i, { as: v || undefined }) })} />
          </Row>
        );
      })}
      <div><Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label="Add group" isDisabled={!cols.length} onClick={() => set({ breakouts: [...brks, { col: cols[0].ref, bucket: 'none' }] })} /></div>

      {aggs.length > 0 && <>
        <p className="mt-1 text-xs font-medium text-muted-foreground">Keep only summary rows where</p>
        <FilterEditor filters={st.having} cols={[...aggs.map((a, i) => aggCol(a.as, a.fn, a.col, i)), ...brks.map((b) => ({ key: `s:${b.as ?? ''}`, label: b.as ?? '', ref: b.as ?? '', kind: 'text' as const, column: b.as ?? '' }))].filter((c) => c.column)}
          addLabel="Add summary filter" onChange={(having) => set({ having })} />
      </>}
    </Step>
  );
}

const aggCol = (as: string | undefined, fn: string, col: unknown, i: number): ColOpt => {
  const base = typeof col === 'object' && col ? (col as { c: string }).c : String(col ?? '');
  const name = as || (fn === 'count' ? 'count' : `${fn} of ${base}`);
  return { key: `s:${name}`, label: name || `metric ${i + 1}`, ref: name, kind: 'num', column: name };
};
