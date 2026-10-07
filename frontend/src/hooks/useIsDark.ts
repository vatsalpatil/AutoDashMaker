import { useEffect, useState } from 'react';

/** True while the `dark` class is on <html> (set by the theme system); updates when it changes. */
export function useIsDark(): boolean {
  const root = document.documentElement;
  const [dark, setDark] = useState(root.classList.contains('dark'));
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(root.classList.contains('dark')));
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [root]);
  return dark;
}
