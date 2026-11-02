import { useEffect, type PointerEvent, type RefObject } from 'react';

/**
 * Landing-page motion, CSS-driven:
 * - `[data-reveal]` children get `.is-visible` when they scroll into view (staggered by `--d` in CSS).
 * - the root gets `--scroll` (0 → 1 over the first 700px) so the hero can untilt as you scroll.
 */
export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    el.querySelectorAll('[data-reveal]').forEach((n) => io.observe(n));

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => el.style.setProperty('--scroll', String(Math.min(window.scrollY / 700, 1))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [root]);
}

/** Pointer-follow 3D tilt + spotlight: sets `--rx/--ry` (degrees) and `--mx/--my` (%) on the element. */
export const tilt = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    const t = e.currentTarget, r = t.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    t.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
    t.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
    t.style.setProperty('--mx', `${x * 100}%`);
    t.style.setProperty('--my', `${y * 100}%`);
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  },
};
