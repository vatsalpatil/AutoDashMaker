import { useEffect, useRef, useState } from 'react';

/**
 * Decorative three.js canvas (see dataScene.ts). three is imported only when the canvas comes near the screen,
 * so it never weighs down the app itself. Falls back to nothing if WebGL is unavailable.
 */
export function Scene3D({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState(0);   // bumps when the theme changes, so the scene repaints in the new colours

  useEffect(() => {
    let t = 0;
    const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(() => setTheme((n) => n + 1), 150); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => { mo.disconnect(); clearTimeout(t); };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let cleanup: (() => void) | undefined, cancelled = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      import('./dataScene').then(({ createDataScene }) => {
        if (cancelled) return;
        try { cleanup = createDataScene(el, { still: window.matchMedia('(prefers-reduced-motion: reduce)').matches }); } catch { setFailed(true); }
      });
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); cleanup?.(); };
  }, [theme]);

  if (failed) return null;
  return <canvas ref={canvas} className={`block size-full ${className}`} aria-hidden />;
}
