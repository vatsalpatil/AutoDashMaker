import { useState } from 'react';
import { SECTIONS, type SectionId } from '@/features/guide/guideContent';
import { ConceptsSection } from '@/features/guide/sections/ConceptsSection';
import { FaqSection } from '@/features/guide/sections/FaqSection';
import { FlowsSection } from '@/features/guide/sections/FlowsSection';
import { GettingStartedSection } from '@/features/guide/sections/GettingStartedSection';
import { TipsSection } from '@/features/guide/sections/TipsSection';
import { WalkthroughsSection } from '@/features/guide/sections/WalkthroughsSection';
import { WelcomeSection } from '@/features/guide/sections/WelcomeSection';
import { cn } from '@/lib/utils';

/** In-app help: a section list on the left, the chosen section on the right. Content lives in features/guide. */
export default function GuidePage() {
  const [active, setActive] = useState<SectionId>('welcome');

  return (
    <div className="flex gap-8">
      <nav className="sticky top-6 hidden w-52 shrink-0 self-start md:block" aria-label="Guide sections">
        <ul className="flex flex-col gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => setActive(id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  active === id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="fixed bottom-4 right-4 z-10 md:hidden">
        <select
          value={active}
          onChange={(e) => setActive(e.target.value as SectionId)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm shadow-lg"
          aria-label="Guide section"
        >
          {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
        {active === 'welcome' && <WelcomeSection onStart={() => setActive('getting-started')} />}
        {active === 'getting-started' && <GettingStartedSection />}
        {active === 'concepts' && <ConceptsSection />}
        {active === 'flows' && <FlowsSection />}
        {active === 'walkthroughs' && <WalkthroughsSection />}
        {active === 'tips' && <TipsSection />}
        {active === 'faq' && <FaqSection />}
      </div>
    </div>
  );
}
