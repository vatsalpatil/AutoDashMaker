import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  key: string;      // localStorage key for the remembered width
  initial: number;  // px
  min: number;
  max: number;
  /** Which side of the panel the handle is on: 'right' = panel is left of the handle (drag right to grow). */
  edge: 'right' | 'left';
}

const KEYBOARD_STEP = 16;
/** Never let one panel push the main column below this many px (handle space included). */
const RESERVED_FOR_MAIN = 480;

function clampTo(v: number, min: number, max: number) {
  const ceiling = Math.max(min, Math.min(max, window.innerWidth - RESERVED_FOR_MAIN));
  return Math.round(Math.min(Math.max(v, min), ceiling));
}

/** Width state for a resizable panel; persisted per browser, clamped to [min, max]. */
export function useResizableWidth({ key, initial, min, max, edge }: Options) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return clampTo(saved > 0 ? saved : initial, min, max);
    } catch {
      return clampTo(initial, min, max);
    }
  });
  const startWidth = useRef(width);

  const persist = useCallback((w: number) => {
    try { localStorage.setItem(key, String(w)); } catch { /* storage unavailable */ }
  }, [key]);

  const onStart = useCallback(() => { startWidth.current = width; }, [width]);
  const onDrag = useCallback((dx: number) => {
    setWidth(clampTo(startWidth.current + (edge === 'right' ? dx : -dx), min, max));
  }, [edge, min, max]);
  const onEnd = useCallback(() => setWidth((w) => { persist(w); return w; }), [persist]);
  const onNudge = useCallback((dir: 1 | -1) => setWidth((w) => {
    const next = clampTo(w + dir * KEYBOARD_STEP * (edge === 'right' ? 1 : -1), min, max);
    persist(next);
    return next;
  }), [edge, min, max, persist]);
  const onReset = useCallback(() => {
    const next = clampTo(initial, min, max);
    setWidth(next);
    persist(next);
  }, [initial, min, max, persist]);

  // keep the panel inside the limits when the window itself is resized
  useEffect(() => {
    const onResize = () => setWidth((w) => clampTo(w, min, max));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [min, max]);

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
}

/** Thin vertical grip between two panels. Drag to resize, double-click to reset, ←/→ when focused. */
export function ResizeHandle({ onStart, onDrag, onEnd, onNudge, onReset, valueNow, min, max, label = 'Resize panel' }: HandleProps) {
  const [dragging, setDragging] = useState(false);
  const originX = useRef(0);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    originX.current = e.clientX;
    onStart();
    setDragging(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging) onDrag(e.clientX - originX.current);
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
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  return (
    // zero-width: the divider line is the neighbouring panel's border; this only adds a wider grab area on top of it
    <div className="relative z-20 w-0 shrink-0 self-stretch">
    <div
      role="separator"
      aria-orientation="vertical"
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
        if (e.key === 'ArrowLeft') { e.preventDefault(); onNudge(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onNudge(1); }
        if (e.key === 'Home' || e.key === 'Enter') { e.preventDefault(); onReset(); }
      }}
      className="group absolute inset-y-0 -left-1.5 w-3 cursor-col-resize touch-none outline-hidden"
    >
      <div className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${dragging ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-400 group-focus-visible:bg-blue-500'}`} />
    </div>
    </div>
  );
}
