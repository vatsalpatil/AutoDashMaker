import { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/** Right-hand "On this page" list built from the page's h2[id] headings, with scroll-spy. */
export function DocsToc({ root, page }: { root: RefObject<HTMLElement | null>; page: string }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const hs = [...(root.current?.querySelectorAll('h2[id]') ?? [])] as HTMLElement[];
    setItems(hs.map((h) => ({ id: h.id, text: h.firstChild?.textContent ?? h.id })));
    const obs = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [root, page]);

  if (!items.length) return null;
  return (
    <nav aria-label="On this page" className="sticky top-30 hidden w-52 shrink-0 self-start xl:block">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
      <ul className="border-l text-sm">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth' }); }}
              className={cn('-ml-px block border-l py-1 pl-3', active === i.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{i.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
