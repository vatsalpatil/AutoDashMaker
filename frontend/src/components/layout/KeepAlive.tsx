import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Keeps work-in-progress pages mounted after their first visit (hidden, not unmounted), so moving between tabs never
 * resets a half-built query, notebook, chat or form. Pages are listed by exact path; everything else routes normally.
 */
export function KeepAlive({ pages }: { pages: Record<string, ReactNode> }) {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => { if (path in pages) setSeen((s) => (s.includes(path) ? s : [...s, path])); }, [path, pages]);
  const mounted = path in pages && !seen.includes(path) ? [...seen, path] : seen;
  return (
    <>
      {mounted.map((p) => <div key={p} hidden={p !== path} className="h-full min-h-0">{pages[p]}</div>)}
    </>
  );
}
