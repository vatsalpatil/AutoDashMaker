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

const chip = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary hover:text-primary disabled:opacity-40 disabled:pointer-events-none';
const icon = 'grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground';

/** Sidebar list of boxes: rename, lock, delete, remove a member, add the current selection. */
export function BoxList({ boxes, selected, nameOf, set, onCreate }: {
  boxes: Box[]; selected: Set<string>; nameOf: (w: Widget) => string; set: SetFn; onCreate: () => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <button type="button" className={`${chip} w-full justify-center`} disabled={selected.size === 0} onClick={onCreate}>
        <Plus className="size-3.5" />New box from selection{selected.size ? ` (${selected.size})` : ''}
      </button>
      {boxes.length === 0 && <p className="text-muted-foreground">Select widgets, then make a box. Dragging any member moves the whole box.</p>}
      {boxes.map((b) => (
        <div key={b.id} className="space-y-1.5 rounded-lg border p-2">
          <div className="flex items-center gap-1">
            <input defaultValue={b.name} aria-label="Box name" className="min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 font-medium"
              onBlur={(e) => e.target.value.trim() && e.target.value !== b.name && b.members.forEach((w) => set(w.id, 'groupName', e.target.value.trim()))} />
            <button type="button" className={icon} title={b.locked ? 'Unlock position' : 'Lock position'} aria-label={b.locked ? 'Unlock box' : 'Lock box'}
              onClick={() => b.members.forEach((w) => set(w.id, 'groupLocked', !b.locked))}>
              {b.locked ? <Lock className="size-3.5 text-primary" /> : <LockOpen className="size-3.5" />}
            </button>
            <button type="button" className={`${icon} hover:text-destructive`} title="Delete box (widgets stay)" aria-label="Delete box"
              onClick={() => b.members.forEach((w) => set(w.id, 'group', null))}><Trash2 className="size-3.5" /></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {b.members.map((w) => (
              <span key={w.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <span className="truncate">{nameOf(w)}</span>
                <button type="button" aria-label="Remove from box" className="shrink-0 hover:text-destructive" onClick={() => set(w.id, 'group', null)}><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <button type="button" className={chip} disabled={![...selected].some((id) => !b.members.some((w) => w.id === id))}
            onClick={() => joinBox(selected, b, set)}><Plus className="size-3" />Add selected</button>
        </div>
      ))}
    </div>
  );
}
