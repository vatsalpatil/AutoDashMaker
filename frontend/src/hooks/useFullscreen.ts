import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser fullscreen for one element: `<div ref={ref} className={active ? overlayClass : ''}>…</div>` + `toggle()`.
 * `active` follows Esc and F11-style exits too. When the browser refuses real fullscreen (embedded views, policies),
 * it falls back to covering the window (`pseudo`), so callers should add `FULLSCREEN_OVERLAY` while `pseudo` is true.
 */
export const FULLSCREEN_OVERLAY = 'fixed inset-0 z-[100] overflow-auto';

export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [real, setReal] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  useEffect(() => {
    const on = () => setReal(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  useEffect(() => {   // Esc closes the fallback overlay like it closes real fullscreen
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPseudo(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudo]);
  const toggle = useCallback(() => {
    if (pseudo) { setPseudo(false); return; }
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const el = ref.current;
    const req = el?.requestFullscreen?.();
    if (!req) { setPseudo(true); return; }
    req.catch(() => setPseudo(true));
    // some embedded browsers leave the request pending forever: fall back if nothing happened shortly
    setTimeout(() => { if (document.fullscreenElement !== el) setPseudo(true); }, 800);
  }, [pseudo]);
  return { ref, active: real || pseudo, pseudo, toggle };
}
