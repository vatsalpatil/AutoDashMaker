import { useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { sameLayout } from './layoutOps';

/** Undo / redo over layout changes. `commit` is the single entry point for every change (drag, inspector, presets). */
export function useLayoutHistory(layout: Layout[], apply: (l: Layout[]) => void) {
  const past = useRef<Layout[][]>([]);
  const future = useRef<Layout[][]>([]);
  const [, bump] = useState(0);

  const commit = (next: Layout[]) => {
    if (sameLayout(next, layout)) return;   // the grid re-reports an unchanged layout on every render
    past.current = [...past.current.slice(-49), layout];
    future.current = [];
    apply(next);
    bump((n) => n + 1);
  };
  const step = (from: React.MutableRefObject<Layout[][]>, to: React.MutableRefObject<Layout[][]>) => {
    const prev = from.current.pop();
    if (!prev) return;
    to.current.push(layout);
    apply(prev);
    bump((n) => n + 1);
  };
  return {
    commit,
    undo: () => step(past, future),
    redo: () => step(future, past),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
