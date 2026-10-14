import { useRef } from 'react';
import type { Layout } from 'react-grid-layout';

/** While a widget is resized, its neighbours make room instead of the grid shoving the resized widget below them:
 *  each neighbour it now overlaps slides right if there is free space, otherwise moves down (and so on down the chain).
 *  Every frame starts from the positions at resize start, so shrinking back lets neighbours return. */
const hit = (a: Layout, b: Layout) => a.i !== b.i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function makeRoom(layout: Layout[], moved: Layout, cols: number, depth = 0) {
  if (depth > 50) return;
  for (const c of layout) {
    if (c.static || !hit(moved, c)) continue;
    const right = moved.x + moved.w;
    const fitsRight = c.x >= moved.x && right + c.w <= cols && !layout.some((o) => o !== c && o !== moved && hit({ ...c, x: right }, o));
    if (fitsRight) c.x = right;
    else c.y = moved.y + moved.h;
    makeRoom(layout, c, cols, depth + 1);
  }
}

export function useResizePush(cols: number) {
  const start = useRef<Map<string, { x: number; y: number }>>(new Map());
  return {
    onResizeStart: (layout: Layout[]) => { start.current = new Map(layout.map((l) => [l.i, { x: l.x, y: l.y }])); },
    // RGL hands us its working layout before it re-compacts; adjusting the items in place is what it then renders
    onResize: (layout: Layout[], _old: Layout, item: Layout) => {
      for (const l of layout) {
        const s = start.current.get(l.i);
        if (s && l.i !== item.i && !l.static) { l.x = s.x; l.y = s.y; }
      }
      const resized = layout.find((l) => l.i === item.i);
      if (resized) makeRoom(layout, resized, cols);
    },
  };
}
