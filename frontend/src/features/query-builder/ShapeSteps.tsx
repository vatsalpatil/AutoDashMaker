import { ArrowUpDown, Filter, Plus, Rows3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/common/SelectField';
import { FilterEditor } from './FilterEditor';
import { WINDOW_FNS, isSummarized, refKey, summaryNames, type ColOpt, type QbStage } from './qbModel';
import { ColSelect, NameInput, Row, Step, patchAt, removeAt } from './ui';

type SetFn = (p: Partial<QbStage>) => void;

export function FilterStep({ st, cols, set }: { st: QbStage; cols: ColOpt[]; set: SetFn }) {
  const n = st.filters?.length ?? 0;
  return (
    <Step icon={<Filter />} title="Filter" tone="warning" defaultOpen={n > 0} badge={n > 1 && (
      <span className="rounded-md bg-muted px-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
        match <select className="bg-transparent" value={st.filter_mode ?? 'and'} onChange={(e) => set({ filter_mode: e.target.value as 'and' | 'or' })}><option value="and">all</option><option value="or">any</option></select>
      </span>
    )}>
      <FilterEditor filters={st.filters} cols={cols} onChange={(filters) => set({ filters })} />
    </Step>
  );
}

export function WindowStep({ st, cols, set }: { st: QbStage; cols: ColOpt[]; set: SetFn }) {
  const ws = st.windows ?? [];
  const pick = isSummarized(st) ? summaryNames(st).map((n): ColOpt => ({ key: refKey(n), label: n, ref: n, kind: 'num', column: n })) : cols;
  return (
    <Step icon={<TrendingUp />} title="Window calculations" tone="success" defaultOpen={ws.length > 0}
      badge={<span className="text-xs text-muted-foreground">running totals · rank · change vs previous</span>}>
      {ws.map((w, i) => {
        const def = WINDOW_FNS.find((f) => f.id === w.fn);
        return (
          <Row key={i} onRemove={() => set({ windows: removeAt(ws, i) })}>
            <SelectField value={w.fn} aria-label="Function" onChange={(e) => set({ windows: patchAt(ws, i, { fn: e.target.value }) })}>
              {WINDOW_FNS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </SelectField>
            {def?.needsCol && <ColSelect cols={pick} value={w.col} placeholder="of column" onChange={(c) => set({ windows: patchAt(ws, i, { col: c.ref }) })} />}
            <ColSelect cols={pick} value={w.order} placeholder="ordered by" onChange={(c) => set({ windows: patchAt(ws, i, { order: c.ref }) })} />
            <SelectField value={w.order_dir ?? 'asc'} aria-label="Direction" onChange={(e) => set({ windows: patchAt(ws, i, { order_dir: e.target.value as 'asc' | 'desc' }) })}>
              <option value="asc">ascending</option><option value="desc">descending</option>
            </SelectField>
            <ColSelect cols={pick} value={w.partition?.[0]} placeholder="restart for each… (optional)" onChange={(c) => set({ windows: patchAt(ws, i, { partition: [c.ref] }) })} />
            {def?.n && <Input type="number" min={1} value={w.n ?? (def.n === 'buckets' ? 4 : 3)} aria-label={def.n} title={def.n} className="h-8" onChange={(e) => set({ windows: patchAt(ws, i, { n: Number(e.target.value) }) })} />}
            <NameInput value={w.as} placeholder="Name (optional)" onChange={(v) => set({ windows: patchAt(ws, i, { as: v || undefined }) })} />
          </Row>
        );
      })}
      <div><Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label="Add calculation" isDisabled={!pick.length} onClick={() => set({ windows: [...ws, { fn: 'running_sum', col: pick[0]?.ref, order: pick[0]?.ref }] })} /></div>
    </Step>
  );
}

/** Sort + row limit, common to every stage. */
export function SortLimitStep({ st, outCols, set }: { st: QbStage; outCols: ColOpt[]; set: SetFn }) {
  const sort = st.sort ?? [];
  return (
    <Step icon={<ArrowUpDown />} title="Sort & limit" tone="primary" defaultOpen={sort.length > 0 || !!st.limit}
      badge={<span className="text-xs text-muted-foreground">{st.limit ? `first ${st.limit.toLocaleString()} rows` : 'no limit'}</span>}>
      {sort.map((s, i) => (
        <Row key={i} onRemove={() => set({ sort: removeAt(sort, i) })}>
          <ColSelect cols={outCols} value={s.col} placeholder="Sort by" onChange={(c) => set({ sort: patchAt(sort, i, { col: c.ref }) })} />
          <SelectField value={s.dir} aria-label="Direction" onChange={(e) => set({ sort: patchAt(sort, i, { dir: e.target.value as 'asc' | 'desc' }) })}>
            <option value="asc">ascending</option><option value="desc">descending</option>
          </SelectField>
        </Row>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label="Add sort" isDisabled={!outCols.length} onClick={() => set({ sort: [...sort, { col: outCols[0].ref, dir: 'desc' }] })} />
        <Rows3 className="ml-2 size-4 text-muted-foreground" />
        <Input type="number" min={1} placeholder="Row limit" value={st.limit ?? ''} aria-label="Row limit" className="h-8 w-28" onChange={(e) => set({ limit: e.target.value ? Number(e.target.value) : undefined })} />
      </div>
    </Step>
  );
}
