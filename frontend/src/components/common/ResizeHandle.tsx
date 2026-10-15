import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  key: string;      // localStorage key for the remembered width
  initial: number;  // px
  min: number;
  max: number;
  /** Which side of the panel the handle is on: 'right' = panel is left of the handle (drag right to grow). */
  edge: 'right' | 'left';
  /** 'y' = a height dragged with a horizontal grip (edge 'right' = drag down to grow). Default 'x'. */
  axis?: 'x' | 'y';
}

const KEYBOARD_STEP = 16;
/** Never let one panel push the main column below this many px (handle space included). */
const RESERVED_FOR_MAIN = 480;

function clampTo(v: number, min: number, max: number, axis: 'x' | 'y' = 'x') {
  const ceiling = axis === 'y' ? max : Math.max(min, Math.min(max, window.innerWidth - RESERVED_FOR_MAIN));
  return Math.round(Math.min(Math.max(v, min), ceiling));
}

/** Width state for a resizable panel; persisted per browser, clamped to [min, max]. */
export function useResizableWidth({ key, initial, min, max, edge, axis = 'x' }: Options) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return clampTo(saved > 0 ? saved : initial, min, max, axis);
    } catch {
      return clampTo(initial, min, max, axis);
    }
  });
  const startWidth = useRef(width);

  const persist = useCallback((w: number) => {
    try { localStorage.setItem(key, String(w)); } catch { /* storage unavailable */ }
  }, [key]);

  const onStart = useCallback(() => { startWidth.current = width; }, [width]);
  const onDrag = useCallback((dx: number) => {
    setWidth(clampTo(startWidth.current + (edge === 'right' ? dx : -dx), min, max, axis));
  }, [edge, min, max, axis]);
  const onEnd = useCallback(() => setWidth((w) => { persist(w); return w; }), [persist]);
  const onNudge = useCallback((dir: 1 | -1) => setWidth((w) => {
    const next = clampTo(w + dir * KEYBOARD_STEP * (edge === 'right' ? 1 : -1), min, max, axis);
    persist(next);
    return next;
  }), [edge, min, max, axis, persist]);
  const onReset = useCallback(() => {
    const next = clampTo(initial, min, max, axis);
    setWidth(next);
    persist(next);
  }, [initial, min, max, axis, persist]);

  // keep the panel inside the limits when the window itself is resized
  useEffect(() => {
    const onResize = () => setWidth((w) => clampTo(w, min, max, axis));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [min, max, axis]);

  return { width, handleProps: { onStart, onDrag, onEnd, onNudge, onReset, valueNow: width, min, max } };
}

interface HandleProps {
  onStart: () => void;
  onDrag: (dx: number) => void;
  onEnd: () => void;
  onNudge: (dir: 1 | -1) => void;
  onReset: () => void;
  valueNow: number;
  min: number;
  max: number;
  label?: string;
  /** true = a horizontal bar that resizes a height (drag up/down, ↑/↓). */
  vertical?: boolean;
}

/** Thin vertical grip between two panels. Drag to resize, double-click to reset, ←/→ when focused. */
export function ResizeHandle({ onStart, onDrag, onEnd, onNudge, onReset, valueNow, min, max, label = 'Resize panel', vertical = false }: HandleProps) {
  const [dragging, setDragging] = useState(false);
  const originX = useRef(0);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    originX.current = vertical ? e.clientY : e.clientX;
    onStart();
    setDragging(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging) onDrag((vertical ? e.clientY : e.clientX) - originX.current);
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    onEnd();
  }

  // while dragging: keep the resize cursor everywhere and stop text selection
  useEffect(() => {
    if (!dragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, vertical]);

  return (
    // zero-width: the divider line is the neighbouring panel's border; this only adds a wider grab area on top of it
    <div className={vertical ? 'relative z-20 h-0 shrink-0' : 'relative z-20 w-0 shrink-0 self-stretch'}>
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) { e.preventDefault(); onNudge(-1); }
        if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) { e.preventDefault(); onNudge(1); }
        if (e.key === 'Home' || e.key === 'Enter') { e.preventDefault(); onReset(); }
      }}
      className={`group absolute touch-none outline-hidden ${vertical ? 'inset-x-0 -top-1.5 h-3 cursor-row-resize' : 'inset-y-0 -left-1.5 w-3 cursor-col-resize'}`}
    >
      <div className={`absolute transition-colors ${vertical ? 'inset-x-0 top-1/2 h-0.5 -translate-y-1/2' : 'inset-y-0 left-1/2 w-0.5 -translate-x-1/2'} ${dragging ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-400 group-focus-visible:bg-blue-500'}`} />
      {/* always-visible grip so the handle is easy to find */}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-card shadow-sm transition-colors ${vertical ? 'h-1.5 w-10' : 'h-10 w-1.5'} ${dragging ? 'border-blue-500 bg-blue-500' : 'border-border group-hover:border-blue-400 group-hover:bg-blue-400'}`} />
    </div>
    </div>
  );
}
