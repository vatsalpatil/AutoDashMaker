/**
 * Auto height (pure, no imports, so node tests can load it): content-sized widgets (ranked lists, groups, time breakdowns,
 * reconcile) get the height their content needs, and whatever sits BELOW them in the same columns moves by the same amount.
 * Gaps you left on purpose are kept and side-by-side widgets never end up overlapping.
 */

export interface Cell { i: string; x: number; y: number; w: number; h: number }

/** Chart types whose content has a natural height (a list or a table), as opposed to charts that should fill the box. */
export const AUTO_HEIGHT_TYPES = new Set(['ranked', 'quadrant', 'timebreak', 'reconcile']);

const overlapX = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w;

/**
 * New layout with the requested heights. Every widget moves by how much the support under it changed: the lowest bottom of
 * the widgets above it (same columns), before vs after. Returns null when nothing changes (so callers don't save for nothing).
 */
export function fitLayout(layout: Cell[], wanted: Map<string, number>): Cell[] | null {
  const order = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = new Map<string, Cell>();
  let changed = false;
  for (const c of order) {
    const above = order.filter((o) => o !== c && o.y + o.h <= c.y && overlapX(o, c) && placed.has(o.i));
    const oldSupport = Math.max(0, ...above.map((o) => o.y + o.h));
    const newSupport = Math.max(0, ...above.map((o) => { const p = placed.get(o.i)!; return p.y + p.h; }));
    const y = Math.max(0, c.y + (newSupport - oldSupport));
    const h = wanted.get(c.i) ?? c.h;
    if (y !== c.y || h !== c.h) changed = true;
    placed.set(c.i, { ...c, y, h });
  }
  return changed ? layout.map((c) => placed.get(c.i)!) : null;
}

/** Grid rows a widget needs for `px` of content (rounded up to whole rows, at least 2, at most `max`). */
export const rowsFor = (px: number, rowPx: number, max = 48) => Math.min(max, Math.max(2, Math.ceil(px / rowPx)));
