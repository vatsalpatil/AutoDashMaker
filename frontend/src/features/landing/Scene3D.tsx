import { useEffect, useRef, useState } from 'react';

/**
 * three.js canvas (see dataScene.ts). three is imported only when the canvas comes near the screen,
 * so it never weighs down the app itself. Falls back to nothing if WebGL is unavailable.
 */
export function Scene3D({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

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
  }, []);

  if (failed) return null;
  return <canvas ref={canvas} className={`block size-full ${className}`} aria-hidden />;
}
