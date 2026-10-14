import type { Layout } from 'react-grid-layout';

/** Pure operations on a grid layout (fine grid units). Each returns a new layout; ids not listed are untouched. */
export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

const pick = (layout: Layout[], ids: Set<string>) => layout.filter((l) => ids.has(l.i));
const map = (layout: Layout[], ids: Set<string>, fn: (l: Layout) => Partial<Layout>) =>
  layout.map((l) => (ids.has(l.i) && !l.static ? { ...l, ...fn(l) } : l));

export const sameLayout = (a: Layout[], b: Layout[]) =>
  a.length === b.length && a.every((l) => {
    const o = b.find((m) => m.i === l.i);
    return o && o.x === l.x && o.y === l.y && o.w === l.w && o.h === l.h;
  });

export function nudge(layout: Layout[], ids: Set<string>, dx: number, dy: number, cols: number) {
  return map(layout, ids, (l) => ({ x: Math.min(Math.max(l.x + dx, 0), cols - l.w), y: Math.max(l.y + dy, 0) }));
}

export function setBox(layout: Layout[], id: string, v: Partial<Pick<Layout, 'x' | 'y' | 'w' | 'h'>>, cols: number) {
  return map(layout, new Set([id]), (l) => {
    const w = Math.min(Math.max(v.w ?? l.w, 1), cols);
    return { w, h: Math.max(v.h ?? l.h, 1), x: Math.min(Math.max(v.x ?? l.x, 0), cols - w), y: Math.max(v.y ?? l.y, 0) };
  });
}

export function align(layout: Layout[], ids: Set<string>, how: Align) {
  const s = pick(layout, ids);
  const left = Math.min(...s.map((l) => l.x)), right = Math.max(...s.map((l) => l.x + l.w));
  const top = Math.min(...s.map((l) => l.y)), bottom = Math.max(...s.map((l) => l.y + l.h));
  return map(layout, ids, (l) => ({
    left: { x: left }, right: { x: right - l.w }, hcenter: { x: Math.round((left + right - l.w) / 2) },
    top: { y: top }, bottom: { y: bottom - l.h }, vcenter: { y: Math.round((top + bottom - l.h) / 2) },
  })[how]);
}

/** Make every selected widget as wide (or tall) as the largest one. */
export function matchSize(layout: Layout[], ids: Set<string>, dim: 'w' | 'h') {
  const size = Math.max(...pick(layout, ids).map((l) => l[dim]));
  return map(layout, ids, () => ({ [dim]: size }));
}

/** Equal gaps between the selected widgets, keeping the outermost two in place. */
export function distribute(layout: Layout[], ids: Set<string>, axis: 'x' | 'y') {
  const dim = axis === 'x' ? 'w' : 'h';
  const s = pick(layout, ids).sort((a, b) => a[axis] - b[axis]);
  if (s.length < 3) return layout;
  const span = s[s.length - 1][axis] + s[s.length - 1][dim] - s[0][axis];
  const gap = (span - s.reduce((t, l) => t + l[dim], 0)) / (s.length - 1);
  const at = new Map<string, number>();
  let pos = s[0][axis];
  s.forEach((l) => { at.set(l.i, Math.round(pos)); pos += l[dim] + gap; });
  return map(layout, ids, (l) => ({ [axis]: at.get(l.i) }));
}

/** Put the selected widgets side by side in one full-width row at the top-most selected position. */
export function toRow(layout: Layout[], ids: Set<string>, cols: number) {
  const s = pick(layout, ids).sort((a, b) => a.x - b.x || a.y - b.y);
  const top = Math.min(...s.map((l) => l.y)), w = Math.floor(cols / Math.max(s.length, 1));
  const h = Math.max(...s.map((l) => l.h));
  const order = new Map(s.map((l, k) => [l.i, k]));
  return map(layout, ids, (l) => ({ x: order.get(l.i)! * w, y: top, w, h }));
}
