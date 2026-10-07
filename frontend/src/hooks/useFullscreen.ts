import { useCallback, useEffect, useRef, useState } from 'react';

/** Browser fullscreen for one element: `<div ref={ref}>…</div>` + `toggle()`. `active` follows Esc and F11-style exits too. */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const on = () => setActive(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  }, []);
  return { ref, active, toggle };
}
