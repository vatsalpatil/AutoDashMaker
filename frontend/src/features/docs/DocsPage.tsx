import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Blocks, LayoutGrid, Lightbulb, Terminal, type LucideIcon } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { SECTIONS } from '@/features/guide/guideContent';
import { AiAssistantSection } from '@/features/guide/sections/AiAssistantSection';
import { ConceptsSection } from '@/features/guide/sections/ConceptsSection';
import { ConnectAiSection } from '@/features/guide/sections/ConnectAiSection';
import { DataPrivacySection } from '@/features/guide/sections/DataPrivacySection';
import { FaqSection } from '@/features/guide/sections/FaqSection';
import { FlowsSection } from '@/features/guide/sections/FlowsSection';
import { GettingStartedSection } from '@/features/guide/sections/GettingStartedSection';
import { SharingSection } from '@/features/guide/sections/SharingSection';
import { TipsSection } from '@/features/guide/sections/TipsSection';
import { WalkthroughsSection } from '@/features/guide/sections/WalkthroughsSection';
import { WelcomeSection } from '@/features/guide/sections/WelcomeSection';
import { ThemePicker } from '@/features/landing/ThemePicker';
import { useThemedShots } from '@/features/landing/motion';
import { FeaturesReference } from './FeaturesReference';
import { ArchitectureSection, SetupSection, UseCasesSection } from './DocsSections';
import '@/features/landing/landing.css';

interface Doc { id: string; label: string; icon: LucideIcon; group: string; render: (go: (id: string) => void) => ReactNode }

const guide = (id: string) => SECTIONS.find((s) => s.id === id)!;
const fromGuide = (id: string, group: string, render: Doc['render']): Doc => ({ id, label: guide(id).label, icon: guide(id).icon, group, render });

/** Public docs: new setup/architecture/use-case pages plus the in-app guide sections. */
const DOCS: Doc[] = [
  fromGuide('welcome', 'Start here', (go) => <WelcomeSection onStart={() => go('setup')} />),
  { id: 'setup', label: 'Install & setup', icon: Terminal, group: 'Start here', render: () => <SetupSection /> },
  { id: 'architecture', label: 'Architecture', icon: Blocks, group: 'Start here', render: () => <ArchitectureSection /> },
  fromGuide('getting-started', 'Start here', () => <GettingStartedSection />),
  { id: 'use-cases', label: 'Use cases & examples', icon: Lightbulb, group: 'Learn', render: () => <UseCasesSection /> },
  { id: 'features', label: 'Every feature', icon: LayoutGrid, group: 'Learn', render: () => <FeaturesReference /> },
  fromGuide('concepts', 'Learn', () => <ConceptsSection />),
  fromGuide('flows', 'Learn', () => <FlowsSection />),
  fromGuide('walkthroughs', 'Learn', () => <WalkthroughsSection />),
  fromGuide('ai', 'AI', () => <AiAssistantSection />),
  fromGuide('connect-ai', 'AI', () => <ConnectAiSection />),
  fromGuide('sharing', 'More', () => <SharingSection />),
  fromGuide('privacy', 'More', () => <DataPrivacySection />),
  fromGuide('tips', 'More', () => <TipsSection />),
  fromGuide('faq', 'More', () => <FaqSection />),
];
const GROUPS = [...new Set(DOCS.map((d) => d.group))];

const initial = () => { const h = window.location.hash.slice(1); return DOCS.some((d) => d.id === h) ? h : 'welcome'; };

/** Public documentation page at /docs, opened from the landing header. */
export function DocsPage({ onEnter, onHome }: { onEnter: () => void; onHome: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useThemedShots(root);
  const [active, setActive] = useState(initial);
  const go = (id: string) => { setActive(id); history.replaceState(null, '', `#${id}`); window.scrollTo(0, 0); };
  const i = DOCS.findIndex((d) => d.id === active);
  const doc = DOCS[i];

  return (
    <div ref={root} className="lp min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <button type="button" onClick={onHome} className="flex items-center gap-2 text-lg font-semibold"><LogoIcon className="size-7" />{BRAND_NAME}<span className="font-normal text-muted-foreground">Docs</span></button>
          <div className="flex items-center gap-2">
            <ThemePicker />
            <Button variant="primary" size="sm" className="rounded-full" onClick={onEnter} icon={<ArrowRight className="order-last size-3.5" />} label="Get started" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <nav className="sticky top-22 hidden w-56 shrink-0 self-start md:block" aria-label="Docs sections">
          {GROUPS.map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
              {DOCS.filter((d) => d.group === g).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => go(id)}
                  className={cn('flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors', active === id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted')}>
                  <Icon className="size-4 shrink-0" />{label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          <select value={active} onChange={(e) => go(e.target.value)} aria-label="Docs section" className="rounded-md border bg-card px-3 py-2 text-sm md:hidden">
            {DOCS.map((d) => <option key={d.id} value={d.id}>{d.group} · {d.label}</option>)}
          </select>
          {doc.render(go)}
          <div className="mt-6 flex justify-between gap-3 border-t pt-6 text-sm">
            {i > 0 ? <button type="button" onClick={() => go(DOCS[i - 1].id)} className="flex items-center gap-1 text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />{DOCS[i - 1].label}</button> : <span />}
            {i < DOCS.length - 1 && <button type="button" onClick={() => go(DOCS[i + 1].id)} className="flex items-center gap-1 font-medium text-primary">{DOCS[i + 1].label}<ArrowRight className="size-4" /></button>}
          </div>
        </main>
      </div>
    </div>
  );
}
