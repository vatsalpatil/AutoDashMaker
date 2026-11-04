import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Menu, ThumbsDown, ThumbsUp } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { ThemePicker } from '@/features/landing/ThemePicker';
import { useThemedShots } from '@/features/landing/motion';
import { DocsSearch } from './DocsSearch';
import { DocsToc } from './DocsToc';
import { PAGES, TABS } from './docsNav';
import '@/features/landing/landing.css';

const initial = () => { const h = window.location.hash.slice(1); return PAGES.some((d) => d.id === h) ? h : 'overview'; };

/** Public documentation at /docs: top tabs, grouped sidebar, page, "On this page" TOC, prev/next. */
export function DocsPage({ onEnter, onHome }: { onEnter: () => void; onHome: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  useThemedShots(root);
  const [active, setActive] = useState(initial);
  const [menu, setMenu] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);
  const go = (id: string) => { setActive(id); setMenu(false); setVoted(null); history.replaceState(null, '', `#${id}`); window.scrollTo(0, 0); };
  useEffect(() => { document.title = `${PAGES.find((p) => p.id === active)?.title} · ${BRAND_NAME} Docs`; }, [active]);

  const i = PAGES.findIndex((d) => d.id === active);
  const page = PAGES[i];
  const inTab = PAGES.filter((p) => p.tab === page.tab);
  const groups = [...new Set(inTab.map((p) => p.group))];
  const prev = PAGES[i - 1], next = PAGES[i + 1];

  const sidebar = groups.map((g) => (
    <div key={g} className="mb-5">
      <p className="mb-1.5 px-3 text-xs font-semibold text-foreground">{g}</p>
      {inTab.filter((d) => d.group === g).map((d) => (
        <button key={d.id} type="button" onClick={() => go(d.id)}
          className={cn('block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors', active === d.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{d.title}</button>
      ))}
    </div>
  ));

  return (
    <div ref={root} className="lp min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4">
          <button type="button" className="md:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu"><Menu className="size-5" /></button>
          <button type="button" onClick={onHome} className="flex shrink-0 items-center gap-2 text-lg font-semibold"><LogoIcon className="size-7" />{BRAND_NAME}<span className="font-normal text-muted-foreground">Docs</span></button>
          <div className="mx-auto w-full max-w-md"><DocsSearch go={go} /></div>
          <ThemePicker />
          <Button variant="primary" size="sm" className="hidden rounded-full sm:flex" onClick={onEnter} icon={<ArrowRight className="order-last size-3.5" />} label="Open app" />
        </div>
        <nav className="mx-auto flex max-w-[90rem] gap-5 overflow-x-auto px-4 text-sm" aria-label="Docs tabs">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => go(PAGES.find((p) => p.tab === t)!.id)}
              className={cn('-mb-px whitespace-nowrap border-b-2 py-2.5', page.tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t}</button>
          ))}
        </nav>
      </header>

      {menu && <div className="fixed inset-x-0 bottom-0 top-[6.25rem] z-20 overflow-y-auto bg-background p-4 md:hidden">{sidebar}</div>}

      <div className="mx-auto flex max-w-[90rem] gap-10 px-4">
        <aside className="sticky top-[6.25rem] hidden h-[calc(100svh-6.25rem)] w-60 shrink-0 overflow-y-auto py-8 md:block" aria-label="Docs pages">{sidebar}</aside>

        <main ref={main} className="flex min-w-0 max-w-3xl flex-1 flex-col gap-5 py-8">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">{page.tab}<ChevronRight className="size-3" />{page.group}</p>
          {page.render(go)}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6 text-sm text-muted-foreground">
            {voted ? <span>Thanks for the feedback.</span> : <>
              <span>Was this page helpful?</span>
              {[['yes', ThumbsUp], ['no', ThumbsDown]].map(([k, Icon]) => {
                const I = Icon as typeof ThumbsUp;
                return <button key={k as string} type="button" onClick={() => setVoted(k as string)} className="flex items-center gap-1 rounded-full border px-3 py-1 hover:border-primary hover:text-foreground"><I className="size-3.5" />{k === 'yes' ? 'Yes' : 'No'}</button>;
              })}
            </>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prev ? <button type="button" onClick={() => go(prev.id)} className="rounded-xl border p-4 text-left hover:border-primary"><span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="size-3" />Previous</span><span className="font-medium">{prev.title}</span></button> : <span />}
            {next && <button type="button" onClick={() => go(next.id)} className="rounded-xl border p-4 text-right hover:border-primary"><span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Next<ArrowRight className="size-3" /></span><span className="font-medium">{next.title}</span></button>}
          </div>
        </main>

        <div className="py-8"><DocsToc root={main} page={active} /></div>
      </div>
    </div>
  );
}
