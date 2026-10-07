import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const KEY = 'adm.sidebar.width';
const MIN = 176, MAX = 420, COLLAPSE_BELOW = 120;   // px: narrowest / widest open sidebar; dragging under COLLAPSE_BELOW closes it

/** Width saved by an earlier drag, as the value of `--sidebar-width` (undefined = the default). */
export function savedSidebarWidth(): string | undefined {
  try { const w = Number(localStorage.getItem(KEY)); return w >= MIN && w <= MAX ? `${w}px` : undefined; } catch { return undefined; }
}

/** The sidebar's edge: drag to resize (remembered), drag far left to collapse, drag right to reopen; a round chevron button on the divider toggles it. */
export function SidebarResizeRail() {
  const { setOpen, toggleSidebar, state } = useSidebar();
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 4)) return;   // a small wobble is still a click
    if (!d.moved) document.body.classList.add('sidebar-dragging');   // no width animation while dragging
    d.moved = true;
    const wrapper = e.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]');
    if (e.clientX < COLLAPSE_BELOW) { setOpen(false); return; }
    setOpen(true);
    const w = Math.min(MAX, Math.max(MIN, e.clientX));
    wrapper?.style.setProperty('--sidebar-width', `${w}px`);
    try { localStorage.setItem(KEY, String(w)); } catch { /* not persisted */ }
  };
  const onPointerUp = () => {
    drag.current = null;
    document.body.classList.remove('sidebar-dragging');
  };

  return (
    <div className="absolute inset-y-0 -right-2 z-20 hidden w-4 md:block">
      <button type="button" aria-label="Resize sidebar" title="Drag to resize"
        tabIndex={-1} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="absolute inset-0 flex cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:transition-colors hover:after:bg-primary/60 active:after:bg-primary" />
      {/* expand / collapse tab shaped like a bell curve lying on the sidebar border (both tails run tangent to it). Collapsed: it pokes out
          to the right of the rail; expanded: it moves inside the navbar (mirrored, pointing left). Hover changes its colour, nothing moves. */}
      {(() => {
        const open = state === 'expanded';
        return (
          <button type="button" onClick={toggleSidebar} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className={cn('group absolute left-1/2 top-0 flex h-10 w-4 items-center text-primary drop-shadow-md transition-colors hover:text-[color-mix(in_oklab,var(--primary)_70%,black)]',
              open && '-translate-x-full justify-end')}>
            <svg viewBox="0 0 18 64" preserveAspectRatio="none" className={cn('absolute inset-0 size-full', open && '-scale-x-100')} aria-hidden="true">
              <path d="M0 0C0 6 1.5 12 4 18C5.5 24 17 25 17 32C17 39 5.5 40 4 46C1.5 52 0 58 0 64Z" fill="currentColor" />
            </svg>
            <span className={cn("relative grid h-full w-2.5 place-items-center text-primary-foreground", open ? "mr-[5px]" : "ml-[3px]")}>
              {open ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </span>
          </button>
        );
      })()}
    </div>
  );
}
