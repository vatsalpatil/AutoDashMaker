import { useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { makeRoom } from './resizePush';

/** Drag-to-insert: while dragging nothing else moves (the grid allows overlap); the widget under the MOUSE POINTER
 *  (not the dragged widget's centre: a tall widget's centre sits far below where you aim) shows a highlight line on the side it will be inserted (left/right, or top/bottom near its top/bottom quarter).
 *  On drop the widget takes that slot and the others shift right (if there is room) or down to open space. */
type Edge = 'left' | 'right' | 'top' | 'bottom';
export interface InsertTarget { target: Layout; edge: Edge }

type Pt = { x: number; y: number } | null;
function findTarget(layout: Layout[], item: Layout, pt: Pt): InsertTarget | null {
  if (!pt) return null;
  const cx = pt.x, cy = pt.y;
  const t = layout.find((l) => l.i !== item.i && cx >= l.x && cx < l.x + l.w && cy >= l.y && cy < l.y + l.h);
  if (!t) return null;
  const px = (cx - t.x) / t.w, py = (cy - t.y) / t.h;
  return { target: t, edge: py < 0.25 ? 'top' : py > 0.75 ? 'bottom' : px < 0.5 ? 'left' : 'right' };
}

/** `toGrid` converts a mouse event to grid units (columns, rows) on the canvas. */
export function useDropInsert(cols: number, toGrid: (e: MouseEvent) => Pt) {
  const [hint, setHint] = useState<InsertTarget | null>(null);
  const done = useRef<{ id: string; at: InsertTarget | null } | null>(null);
  return {
    hint,
    onDragStart: () => { done.current = null; },
    onDrag: (layout: Layout[], _o: Layout, item: Layout, _p: Layout, e: MouseEvent) => {
      const n = findTarget(layout, item, toGrid(e));
      setHint((h) => (h?.target.i === n?.target.i && h?.edge === n?.edge ? h : n));
    },
    onDragStop: (layout: Layout[], _o: Layout, item: Layout, _p: Layout, e: MouseEvent) => { done.current = { id: item.i, at: findTarget(layout, item, toGrid(e)) }; setHint(null); },
    /** Turn the raw dropped layout into the inserted one. Skipped for group/selection moves (those keep relative positions). */
    apply: (layout: Layout[], hasMates: (id: string) => boolean): Layout[] => {
      const d = done.current;
      done.current = null;
      if (!d || hasMates(d.id)) return layout;
      const out = layout.map((l) => ({ ...l }));
      const me = out.find((l) => l.i === d.id);
      if (!me) return layout;
      if (d.at) {
        const t = d.at.target;
        if (d.at.edge === 'left') { me.x = t.x; me.y = t.y; }
        if (d.at.edge === 'right') { me.x = Math.min(t.x + t.w, cols - me.w); me.y = t.y; }
        if (d.at.edge === 'top') { me.x = Math.min(t.x, cols - me.w); me.y = t.y; }
        if (d.at.edge === 'bottom') { me.x = Math.min(t.x, cols - me.w); me.y = t.y + t.h; }
      }
      makeRoom(out, me, cols, d.at?.edge === 'top' || d.at?.edge === 'bottom');
      return out;
    },
  };
}

/** The highlight line for the current insert target. */
export function InsertLine({ hint, colW, rowH }: { hint: InsertTarget | null; colW: number; rowH: number }) {
  if (!hint) return null;
  const t = hint.target, v = hint.edge === 'left' || hint.edge === 'right';
  const style = v
    ? { left: (hint.edge === 'left' ? t.x : t.x + t.w) * colW - 2, top: t.y * rowH + 6, width: 4, height: t.h * rowH - 12 }
    : { top: (hint.edge === 'top' ? t.y : t.y + t.h) * rowH - 2, left: t.x * colW + 6, height: 4, width: t.w * colW - 12 };
  return <div className="pointer-events-none absolute z-40 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" style={style} />;
}
