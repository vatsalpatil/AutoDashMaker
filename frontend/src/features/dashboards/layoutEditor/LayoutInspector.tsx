import type { Layout } from 'react-grid-layout';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, Boxes, Columns3, MoveHorizontal, MoveVertical, Settings2, Trash2,
} from 'lucide-react';
import type { Widget } from '@/lib/types';
import { align, distribute, matchSize, setBox, toRow, type Align } from './layoutOps';

const btn = 'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40';
const ALIGNS: [Align, React.ReactNode, string][] = [
  ['left', <AlignStartVertical key="l" className="size-4" />, 'Align left edges'],
  ['hcenter', <AlignCenterVertical key="hc" className="size-4" />, 'Align horizontal centres'],
  ['right', <AlignEndVertical key="r" className="size-4" />, 'Align right edges'],
  ['top', <AlignStartHorizontal key="t" className="size-4" />, 'Align top edges'],
  ['vcenter', <AlignCenterHorizontal key="vc" className="size-4" />, 'Align vertical centres'],
  ['bottom', <AlignEndHorizontal key="b" className="size-4" />, 'Align bottom edges'],
];

/** Right-hand panel: exact position/size for one widget, align / match / distribute for several. Sizes are shown in grid units. */
export function LayoutInspector({ layout, selected, widgets, gx, gy, nameOf, commit, onSetting, onSettings, onRemove, onBox }: {
  layout: Layout[]; selected: Set<string>; widgets: Widget[]; gx: number; gy: number;
  nameOf: (w: Widget) => string; commit: (l: Layout[]) => void;
  onSetting: (id: string, key: string, value: unknown) => void; onSettings: (w: Widget) => void; onRemove: (id: string) => void; onBox: () => void;
}) {
  const cols = 12 * gx;
  const sel = widgets.filter((w) => selected.has(w.id));
  if (sel.length === 0) {
    return <p className="text-xs text-muted-foreground">Click a widget to edit it. Ctrl/Shift + click to select several, Ctrl + A for all.</p>;
  }
  if (sel.length === 1) {
    const w = sel[0], l = layout.find((x) => x.i === w.id);
    if (!l) return null;
    const field = (k: 'x' | 'y' | 'w' | 'h', label: string, unit: number) => (
      <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">{label}
        <input type="number" step={1 / unit} min={k === 'w' || k === 'h' ? 1 / unit : 0} value={+(l[k] / unit).toFixed(2)}
          onChange={(e) => e.target.value !== '' && commit(setBox(layout, w.id, { [k]: Math.round(+e.target.value * unit) }, cols))}
          className="rounded-md border bg-transparent px-2 py-1 text-sm text-foreground" />
      </label>
    );
    return (
      <div className="space-y-3">
        <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">Title
          <input key={w.id} defaultValue={nameOf(w)} className="rounded-md border bg-transparent px-2 py-1 text-sm text-foreground"
            onBlur={(e) => e.target.value.trim() !== nameOf(w) && onSetting(w.id, 'title', e.target.value.trim())} />
        </label>
        <div className="grid grid-cols-2 gap-2">{field('x', 'X (column)', gx)}{field('y', 'Y (row)', gy)}{field('w', 'Width (of 12)', gx)}{field('h', 'Height (rows)', gy)}</div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btn} onClick={() => commit(setBox(layout, w.id, { x: 0, w: cols }, cols))}><MoveHorizontal className="size-3.5" />Full width</button>
          <button type="button" className={btn} onClick={() => commit(setBox(layout, w.id, { x: 0, w: cols / 2 }, cols))}>Half · left</button>
          <button type="button" className={btn} onClick={() => commit(setBox(layout, w.id, { x: cols / 2, w: cols / 2 }, cols))}>Half · right</button>
        </div>
        <div className="flex flex-wrap gap-1 border-t pt-3">
          <button type="button" className={btn} onClick={() => onSettings(w)}><Settings2 className="size-3.5" />Widget settings</button>
          <button type="button" className={`${btn} hover:text-destructive`} onClick={() => onRemove(w.id)}><Trash2 className="size-3.5" />Remove</button>
        </div>
      </div>
    );
  }
  const ids = selected;
  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">{sel.length} widgets selected</p>
      <div><p className="mb-1 font-medium">Align</p>
        <div className="flex flex-wrap gap-1">{ALIGNS.map(([k, icon, t]) => <button key={k} type="button" title={t} aria-label={t} className={btn} onClick={() => commit(align(layout, ids, k))}>{icon}</button>)}</div>
      </div>
      <div><p className="mb-1 font-medium">Size & spacing</p>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btn} onClick={() => commit(matchSize(layout, ids, 'w'))}><MoveHorizontal className="size-3.5" />Same width</button>
          <button type="button" className={btn} onClick={() => commit(matchSize(layout, ids, 'h'))}><MoveVertical className="size-3.5" />Same height</button>
          <button type="button" className={btn} disabled={sel.length < 3} onClick={() => commit(distribute(layout, ids, 'x'))}><AlignHorizontalDistributeCenter className="size-3.5" />Spread across</button>
          <button type="button" className={btn} disabled={sel.length < 3} onClick={() => commit(distribute(layout, ids, 'y'))}><AlignVerticalDistributeCenter className="size-3.5" />Spread down</button>
          <button type="button" className={btn} onClick={() => commit(toRow(layout, ids, cols))}><Columns3 className="size-3.5" />One row</button>
        </div>
      </div>
      <button type="button" className={btn} onClick={onBox}><Boxes className="size-3.5" />Put in a new box</button>
    </div>
  );
}
