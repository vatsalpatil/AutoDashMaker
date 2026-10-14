import type { Layout } from 'react-grid-layout';
import { Lock, LockOpen, Plus, Trash2, X } from 'lucide-react';
import type { Widget } from '@/lib/types';
import { groupOf } from './widgetGroups';

/** Boxes = named widget groups (settings.group / groupName / groupLocked on every member).
 *  Members move together; a locked box cannot be dragged or resized. */
type SetFn = (id: string, key: string, value: unknown) => void;
interface Box { id: string; name: string; locked: boolean; members: Widget[] }

export function boxesOf(widgets: Widget[]): Box[] {
  const m = new Map<string, Box>();
  widgets.forEach((w) => {
    const g = groupOf(w);
    if (!g) return;
    const b = m.get(g) ?? { id: g, name: String(w.settings?.groupName ?? 'Box'), locked: !!w.settings?.groupLocked, members: [] };
    b.members.push(w);
    m.set(g, b);
  });
  return [...m.values()];
}

export const isLocked = (w: Widget) => !!groupOf(w) && !!w.settings?.groupLocked;

/** Put widgets into a box (new or existing), carrying the box's name and lock flag. */
export function joinBox(ids: Iterable<string>, box: { id: string; name: string; locked: boolean }, set: SetFn) {
  for (const id of ids) {
    set(id, 'group', box.id);
    set(id, 'groupName', box.name);
    set(id, 'groupLocked', box.locked);
  }
}

/** Dashed frame + name around each box, drawn over the grid (clicks pass through). */
export function BoxFrames({ boxes, layout, colW, rowH }: { boxes: Box[]; layout: Layout[]; colW: number; rowH: number }) {
  const at = new Map(layout.map((l) => [l.i, l]));
  return (
    <>
      {boxes.map((b) => {
        const ls = b.members.map((w) => at.get(w.id)).filter(Boolean) as Layout[];
        if (!ls.length) return null;
        const x = Math.min(...ls.map((l) => l.x)), y = Math.min(...ls.map((l) => l.y));
        const r = Math.max(...ls.map((l) => l.x + l.w)), btm = Math.max(...ls.map((l) => l.y + l.h));
        return (
          <div key={b.id} className="pointer-events-none absolute z-10 rounded-xl border-2 border-dashed border-primary/60"
            style={{ left: x * colW, top: y * rowH, width: (r - x) * colW, height: (btm - y) * rowH }}>
            <span className="absolute -top-2.5 left-3 rounded bg-background px-1.5 text-[11px] font-medium text-primary">
              {b.locked && <Lock className="mr-1 inline size-3" />}{b.name}
            </span>
          </div>
        );
      })}
    </>
  );
}

const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:border-primary hover:text-primary disabled:opacity-50 disabled:pointer-events-none';

export function BoxList({ boxes, selected, nameOf, set, onCreate }: {
  boxes: Box[]; selected: Set<string>; nameOf: (w: Widget) => string; set: SetFn; onCreate: () => void;
}) {
  return (
    <div className="mb-2 space-y-1.5 rounded-lg border p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium">Boxes</span>
        <span className="text-muted-foreground">Ctrl/Shift + click widgets, then create a box or add them to one. Dragging any member moves the box.</span>
        <button type="button" className={`${chip} ml-auto`} disabled={selected.size === 0} onClick={onCreate}><Plus className="size-3" />New box from selection</button>
      </div>
      {boxes.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-1 border-t pt-1.5">
          <input defaultValue={b.name} aria-label="Box name" className="w-28 rounded border bg-transparent px-1.5 py-0.5"
            onBlur={(e) => e.target.value.trim() && e.target.value !== b.name && b.members.forEach((w) => set(w.id, 'groupName', e.target.value.trim()))} />
          <button type="button" className={chip} title={b.locked ? 'Unlock position' : 'Lock position'}
            onClick={() => b.members.forEach((w) => set(w.id, 'groupLocked', !b.locked))}>
            {b.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}{b.locked ? 'Locked' : 'Lock'}
          </button>
          {b.members.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <span className="max-w-32 truncate">{nameOf(w)}</span>
              <button type="button" aria-label="Remove from box" className="hover:text-destructive" onClick={() => set(w.id, 'group', null)}><X className="size-3" /></button>
            </span>
          ))}
          <button type="button" className={chip} disabled={![...selected].some((id) => !b.members.some((w) => w.id === id))}
            onClick={() => joinBox(selected, b, set)}><Plus className="size-3" />Add selected</button>
          <button type="button" className={`${chip} ml-auto hover:text-destructive`} onClick={() => b.members.forEach((w) => set(w.id, 'group', null))}>
            <Trash2 className="size-3" />Delete box
          </button>
        </div>
      ))}
    </div>
  );
}
