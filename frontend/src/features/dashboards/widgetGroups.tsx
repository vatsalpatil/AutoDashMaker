import { useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { Group, Ungroup } from 'lucide-react';
import type { Widget } from '@/lib/types';

/** A widget's group id lives in widget.settings.group; grouped widgets move together when one is dragged. */
export const groupOf = (w?: Widget) => (typeof w?.settings?.group === 'string' ? (w.settings.group as string) : null);

export function useWidgetGroups(widgets: Widget[], onSetting: (id: string, key: string, value: unknown) => void) {
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

  const setGroup = (value: string | null) => {
    selected.forEach((i) => onSetting(i, 'group', value));
    setSelected(new Set());
  };

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

  return { selected, clear: () => setSelected(new Set()), toggle, setGroup, onDragStop, applyGroupMove };
}

export function GroupBar({ count, canUngroup, onGroup, onUngroup, onClear }: {
  count: number; canUngroup: boolean; onGroup: () => void; onUngroup: () => void; onClear: () => void;
}) {
  const btn = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 hover:border-primary hover:text-primary disabled:opacity-50 disabled:pointer-events-none';
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">
        {count ? `${count} selected` : 'Ctrl/Shift + click widgets to select; selected widgets move together — Group keeps them together'}
      </span>
      <button type="button" className={btn} disabled={count < 2} onClick={onGroup}><Group className="size-3.5" />Group</button>
      <button type="button" className={btn} disabled={!canUngroup} onClick={onUngroup}><Ungroup className="size-3.5" />Ungroup</button>
      {count > 0 && <button type="button" className={btn} onClick={onClear}>Clear</button>}
    </div>
  );
}
