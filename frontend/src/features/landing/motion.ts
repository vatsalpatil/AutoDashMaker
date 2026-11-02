import { useEffect, useState, type PointerEvent, type RefObject } from 'react';

/** Index that advances every `ms` through `n` items. Picking one holds it for `holdMs`, then auto-play carries on from there;
 *  picking the item that is already showing resumes at once. Returns [index, pick, playing]. */
export function useCycle(n: number, ms: number, holdMs = 8000): [number, (i: number) => void, boolean] {
  const [state, setState] = useState({ i: 0, auto: true, pick: 0 });
  useEffect(() => {
    if (state.auto) {
      const t = setInterval(() => setState((s) => ({ ...s, i: (s.i + 1) % n })), ms);
      return () => clearInterval(t);
    }
    const t = setTimeout(() => setState((s) => ({ ...s, auto: true })), holdMs);
    return () => clearTimeout(t);
  }, [state.auto, state.pick, n, ms, holdMs]);
  const pick = (i: number) => setState((s) => (s.i === i && !s.auto ? { ...s, auto: true } : { i, auto: false, pick: s.pick + 1 }));
  return [state.i, pick, state.auto];
}

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

/** Hue of the violet the screenshots and clips were recorded in (HSL degrees). */
const SHOT_HUE = 234;   // the default theme's --primary, measured

/** HSL hue (degrees) and saturation (0..1) of a CSS colour as the browser renders it. */
function hueOf(expr: string): [number, number] {
  const probe = document.createElement('span');
  probe.style.color = expr;
  document.body.appendChild(probe);
  const [r, g, b] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((n) => Number(n) / 255);
  probe.remove();
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return [0, 0];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(max + min - 1))];
}

/**
 * Tints the app screenshots and clips (recorded in violet) to the current colour theme: sets `--shot-filter` on
 * `root`, used by `.lp-shot`. Grey accents get a desaturated look. Re-runs when the theme changes.
 */
export function useThemedShots(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const apply = () => {
      const [h, s] = hueOf('var(--primary)');
      root.current?.style.setProperty('--shot-filter', s < 0.15 ? 'saturate(0.25)' : `hue-rotate(${Math.round(h - SHOT_HUE)}deg)`);
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => mo.disconnect();
  }, [root]);
}
