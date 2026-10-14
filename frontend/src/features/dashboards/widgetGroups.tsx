import { useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import type { Widget } from '@/lib/types';

/** A widget's group id lives in widget.settings.group; grouped widgets move together when one is dragged. */
export const groupOf = (w?: Widget) => (typeof w?.settings?.group === 'string' ? (w.settings.group as string) : null);

export function useWidgetGroups(widgets: Widget[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const shift = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const byId = new Map(widgets.map((w) => [w.id, w]));

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    const g = groupOf(byId.get(id));
    // clicking a grouped widget selects/deselects its whole group
    const ids = g ? widgets.filter((w) => groupOf(w) === g).map((w) => w.id) : [id];
    const on = !n.has(id);
    ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
    return n;
  });

  /** Remember how far the dragged widget moved so the next layout change moves its group-mates too. */
  const onDragStop = (_l: Layout[], oldItem: Layout, newItem: Layout) => {
    shift.current = { id: newItem.i, dx: newItem.x - oldItem.x, dy: newItem.y - oldItem.y };
  };

  const applyGroupMove = (layout: Layout[]): Layout[] => {
    const s = shift.current;
    shift.current = null;
    if (!s || (s.dx === 0 && s.dy === 0)) return layout;
    // mates = the current selection (if the dragged widget is in it) plus the dragged widget's saved group
    const g = groupOf(byId.get(s.id));
    const isMate = (i: string) => (selected.has(s.id) && selected.has(i)) || (!!g && groupOf(byId.get(i)) === g);
    return layout.map((l) =>
      l.i !== s.id && isMate(l.i) ? { ...l, x: Math.max(0, l.x + s.dx), y: Math.max(0, l.y + s.dy) } : l);
  };

  return { selected, clear: () => setSelected(new Set()), toggle, onDragStop, applyGroupMove };
}
