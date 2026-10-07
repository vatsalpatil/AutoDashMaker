import { Database, Link2, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { SelectField } from '@/components/common/SelectField';
import { JOIN_TYPES, type ColOpt, type QbJoin, type QbSchema, type QbStage } from './qbModel';
import { ColSelect, Row, Step, patchAt, removeAt } from './ui';

export function SourceStep({ st, schema, set }: { st: QbStage; schema: QbSchema; set: (p: Partial<QbStage>) => void }) {
  const t = schema.tables.find((x) => x.name === st.table);
  return (
    <Step icon={<Database />} title="Data" badge={t && <span className="text-xs text-muted-foreground">{t.columns.length} columns{t.row_count != null ? ` · ${t.row_count.toLocaleString()} rows` : ''}</span>}>
      <SelectField value={st.table ?? ''} placeholder="Pick a table or dataset" aria-label="Table"
        onChange={(e) => set({ table: e.target.value, joins: [], filters: [], aggregations: [], breakouts: [], having: [], windows: [], columns: [], sort: [], custom: [] })}>
        {schema.tables.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
      </SelectField>
    </Step>
  );
}

/** Join more tables; matching columns are suggested from declared relationships and same-named id columns. */
export function JoinStep({ st, schema, cols, set }: { st: QbStage; schema: QbSchema; cols: ColOpt[]; set: (p: Partial<QbStage>) => void }) {
  const joins = st.joins ?? [];
  const tables = [st.table, ...joins.map((j) => j.table)].filter(Boolean) as string[];
  const suggest = (target: string): { on: QbJoin['on']; hint: string } => {
    const l = schema.links.find((k) => (tables.includes(k.left) && k.right === target) || (tables.includes(k.right) && k.left === target));
    if (!l) return { on: [], hint: '' };
    const flip = l.right === target;
    const known = flip ? l.left : l.right;
    const ti = tables.indexOf(known);
    return { on: [{ left: { t: `t${ti}`, c: flip ? l.left_column : l.right_column }, right: { t: `t${joins.length + 1}`, c: flip ? l.right_column : l.left_column } }], hint: l.declared ? 'declared relationship' : 'matching column name' };
  };
  const add = (name: string) => set({ joins: [...joins, { table: name, type: 'left', on: suggest(name).on }] });
  const colsOf = (ti: number) => cols.filter((c) => typeof c.ref === 'object' && c.ref.t === `t${ti}`);
  const linked = schema.tables.filter((x) => x.name !== st.table && schema.links.some((k) => (tables.includes(k.left) && k.right === x.name) || (tables.includes(k.right) && k.left === x.name)));
  return (
    <Step icon={<Link2 />} title="Join data" tone="info" badge={joins.length ? <span className="text-xs text-muted-foreground">{joins.length} joined</span> : undefined} defaultOpen={joins.length > 0}>
      {joins.map((j, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-lg border p-2">
          <Row onRemove={() => set({ joins: removeAt(joins, i) })}>
            <span className="text-sm font-medium">{j.table}</span>
            <SelectField value={j.type} aria-label="Join type" onChange={(e) => set({ joins: patchAt(joins, i, { type: e.target.value }) })}>
              {JOIN_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
          </Row>
          {j.type !== 'cross' && j.on.map((k, n) => (
            <Row key={n} onRemove={j.on.length > 1 ? () => set({ joins: patchAt(joins, i, { on: j.on.filter((_, m) => m !== n) }) }) : undefined}>
              <ColSelect cols={cols.filter((c) => typeof c.ref === 'object' && Number(c.ref.t.slice(1)) <= i)} value={k.left} placeholder="Existing column"
                onChange={(c) => set({ joins: patchAt(joins, i, { on: patchAt(j.on, n, { left: c.ref }) }) })} />
              <span className="!flex-none text-center text-xs text-muted-foreground">=</span>
              <ColSelect cols={colsOf(i + 1)} value={k.right} placeholder="Column in this table"
                onChange={(c) => set({ joins: patchAt(joins, i, { on: patchAt(j.on, n, { right: c.ref }) }) })} />
            </Row>
          ))}
          {j.type !== 'cross' && <div><Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} label="Add matching pair" onClick={() => set({ joins: patchAt(joins, i, { on: [...j.on, { left: cols[0]?.ref, right: colsOf(i + 1)[0]?.ref }] }) })} /></div>}
        </div>
      ))}
      {linked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-primary" />Suggested:
          {linked.map((x) => <button key={x.id} className="rounded-full border bg-card px-2 py-0.5 text-foreground hover:bg-accent" onClick={() => add(x.name)} title={suggest(x.name).hint}>+ {x.name}</button>)}
        </div>
      )}
      <SelectField value="" placeholder="Join another table…" aria-label="Join table" onChange={(e) => e.target.value && add(e.target.value)}>
        {schema.tables.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
      </SelectField>
    </Step>
  );
}
