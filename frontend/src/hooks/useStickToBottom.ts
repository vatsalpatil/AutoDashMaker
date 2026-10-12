import { useCallback, useEffect, useRef, useState } from 'react';

/** Chat-style scrolling: while the user is at (or near) the bottom, growing content keeps it pinned to the newest output;
 * scrolling up pauses that, and `jump()` returns to the bottom. Put `ref` on the scroll container and `contentRef` on its child. */
export function useStickToBottom<T extends HTMLElement = HTMLDivElement, C extends HTMLElement = HTMLDivElement>(threshold = 160) {
  const ref = useRef<T>(null);
  const contentRef = useRef<C>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const jump = useCallback((smooth = true) => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      pinned.current = near;
      setAtBottom(near);
    };
    const follow = () => { if (pinned.current) el.scrollTop = el.scrollHeight; };
    const ro = new ResizeObserver(follow);   // live thinking, new cards, expanding steps: all change the content's height
    ro.observe(content);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); };
  }, [threshold]);

  return { ref, contentRef, atBottom, jump };
}
