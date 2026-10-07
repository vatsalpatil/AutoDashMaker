import { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronsLeft, Columns3, X } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { refKey, refName, type ColOpt, type QbStage, type Ref } from './qbModel';
import { Step } from './ui';

/** Reference to put in the column list; a column name shared by several joined tables gets a unique output name. */
const pickRef = (c: ColOpt, cols: ColOpt[]): Ref =>
  typeof c.ref === 'object' && cols.filter((x) => x.column === c.column).length > 1 ? { ...c.ref, as: c.label.replace(' › ', '_') } : c.ref;

/** Choose which columns the result has and in which ORDER: drag the chips (or select one and use the arrows) to arrange; click a + chip to add. */
export function ColumnsStep({ st, cols, set }: { st: QbStage; cols: ColOpt[]; set: (p: Partial<QbStage>) => void }) {
  const chosen = st.columns ?? [];
  const byKey = new Map(cols.map((c) => [c.key, c]));
  const used = new Set(chosen.map(refKey));
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= chosen.length) return;
    const next = [...chosen];
    next.splice(to, 0, next.splice(from, 1)[0]);
    set({ columns: next });
  };

  return (
    <Step icon={<Columns3 />} title="Pick & arrange columns" tone="info" defaultOpen={chosen.length > 0}
      badge={<span className="text-xs text-muted-foreground">{chosen.length ? `${chosen.length} in this order` : 'all columns'}</span>}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" label="Select all" onClick={() => set({ columns: cols.filter((c) => !c.label.endsWith('(custom)')).map((c) => pickRef(c, cols)) })} />
        <Button size="sm" variant="ghost" label="Clear (show everything)" isDisabled={!chosen.length} onClick={() => set({ columns: [] })} />
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <ol className="flex flex-wrap gap-1" aria-label="Result columns, in order">
            {chosen.map((r, i) => (
              <li key={refKey(r)} draggable onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
                className={cn('flex cursor-grab items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-xs', sel === i && 'border-primary bg-primary/10 text-primary',
                  drag === i && 'opacity-40', over === i && drag !== null && drag !== i && 'border-primary')}>
                <button type="button" onClick={() => setSel(sel === i ? null : i)} aria-pressed={sel === i} className="flex items-center gap-1" title="Drag to move, click to select">
                  <span className="tabular-nums text-muted-foreground">{i + 1}</span>{byKey.get(refKey(r))?.label ?? refName(r)}
                </button>
              </li>
            ))}
          </ol>
          {sel !== null && chosen[sel] !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground">{byKey.get(refKey(chosen[sel]))?.label ?? refName(chosen[sel])}</span>
              <Button size="sm" variant="ghost" aria-label="Move earlier" title="Move earlier" isDisabled={sel === 0} icon={<ArrowLeft className="size-3.5" />} onClick={() => { move(sel, sel - 1); setSel(sel - 1); }} />
              <Button size="sm" variant="ghost" aria-label="Move later" title="Move later" isDisabled={sel === chosen.length - 1} icon={<ArrowRight className="size-3.5" />} onClick={() => { move(sel, sel + 1); setSel(sel + 1); }} />
              <Button size="sm" variant="ghost" aria-label="Move to start" title="Move to start" isDisabled={sel === 0} icon={<ChevronsLeft className="size-3.5" />} onClick={() => { move(sel, 0); setSel(0); }} />
              <Button size="sm" variant="ghost" aria-label="Remove column" title="Remove from result" icon={<X className="size-3.5" />} onClick={() => { set({ columns: chosen.filter((_, j) => j !== sel) }); setSel(null); }} />
            </div>
          )}
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">{chosen.length ? 'Add more columns' : 'Click columns to build your own list, then arrange them'}</p>
      <div className="flex flex-wrap gap-1.5">
        {cols.filter((c) => !used.has(c.key)).map((c) => (
          <button key={c.key} type="button" onClick={() => set({ columns: [...chosen, pickRef(c, cols)] })}
            className="rounded-full border bg-card px-2.5 py-0.5 text-xs hover:bg-accent">+ {c.label}</button>
        ))}
        {cols.every((c) => used.has(c.key)) && <span className="text-xs text-muted-foreground">Every column is in the list.</span>}
      </div>
      {chosen.length > 0 && chosen.length < cols.length && <p className="text-xs text-warning">{cols.length - chosen.length} column(s) are not in the result. Only the columns in this list are shown; add more with the + chips, or press clear to show everything.</p>}
      <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" checked={!!st.distinct} onChange={(e) => set({ distinct: e.target.checked })} />Remove duplicate rows</label>
    </Step>
  );
}
