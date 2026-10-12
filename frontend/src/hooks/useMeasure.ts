import { useCallback, useEffect, useState } from 'react';

/**
 * Measure the real pixel size of an element so charts and grids fit it exactly.
 * Returns a callback ref (attach it with `ref={ref}`): it follows the element even when that element mounts later than the component,
 * e.g. a grid that only appears once its page has widgets.
 */
export function useMeasure() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, size] as const;
}
