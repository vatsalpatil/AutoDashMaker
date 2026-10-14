import { useEffect, useRef } from 'react';

/** Editor shortcuts: arrows nudge (Shift = bigger step), Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo/redo, Ctrl+A all, Esc clears. */
export function useEditorKeys(h: { nudge: (dx: number, dy: number, big: boolean) => void; undo: () => void; redo: () => void; all: () => void; clear: () => void }) {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, a = ref.current;
      const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (arrows[k]) a.nudge(...arrows[k], e.shiftKey);
      else if (mod && k === 'z') (e.shiftKey ? a.redo : a.undo)();
      else if (mod && k === 'y') a.redo();
      else if (mod && k === 'a') a.all();
      else if (k === 'escape') a.clear();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
