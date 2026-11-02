import { useRef } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button } from '@/components/ui/kit';
import { FEATURES, SHOTS } from './landingContent';
import { Lifecycle } from './Lifecycle';
import { ProductExplorer } from './ProductExplorer';
import { ChartStrip } from './ChartStrip';
import { ThemePicker } from './ThemePicker';
import { SHOWCASE_POINTS } from './landingInfo';
import { Hero3D } from './Hero3D';
import { Heading, LandingDetails } from './LandingDetails';
import { tilt, useLandingMotion } from './motion';
import './landing.css';

/** Facts about the demo workspace the screenshots were taken from. */
const DEMO_STATS = [['1 CSV file', 'uploaded'], ['1,500', 'rows profiled'], ['6', 'columns typed automatically'], ['8', 'charts built'], ['1', 'dashboard with KPIs, trends and breakdowns']];

const delay = (i: number) => ({ '--d': `${i * 0.08}s` }) as React.CSSProperties;

/** Brand landing page: the first thing a visitor sees. `onEnter` moves them on to the app (or sign-in). */
export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root);
  return (
    <div ref={root} className="lp min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-lg font-semibold"><LogoIcon className="size-7" />{BRAND_NAME}</div>
          <div className="flex items-center gap-2">
            <ThemePicker />
            <Button variant="secondary" size="sm" className="rounded-full" onClick={onEnter} label="Open the app" />
          </div>
        </div>
      </header>

      <Hero3D onEnter={onEnter} />

      <ChartStrip />


      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 data-reveal className="text-center text-3xl font-semibold sm:text-4xl">Everything from raw data to decision</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <div key={title} data-reveal style={delay(i)}>
              <div className="lp-tilt h-full rounded-2xl border bg-card p-6" {...tilt}>
                <div className="lp-pop flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30"><Icon className="size-5" /></div>
                <h3 className="lp-pop mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Lifecycle />

      <ProductExplorer />

      <section className="mx-auto max-w-6xl space-y-28 px-4 py-16">
        <div>
          <Heading eyebrow="Real screens, real data" title={`See ${BRAND_NAME} at work`}
            text="Every picture below is a real screen from the app, not a mock-up. We uploaded one sales file and went from raw rows to a finished dashboard in a few minutes." />
          <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3">
            {DEMO_STATS.map(([n, l]) => (
              <span key={l} className="rounded-full border bg-card px-4 py-2 text-sm"><b className="text-primary">{n}</b> <span className="text-muted-foreground">{l}</span></span>
            ))}
          </div>
        </div>
        {SHOTS.showcase.map((s, i) => (
          <div key={s.src} className="grid items-center gap-10 md:grid-cols-5">
            <div data-reveal className={`md:col-span-2 ${i % 2 ? 'md:order-last' : ''}`}>
              <span className="text-sm font-medium text-primary">0{i + 1}</span>
              <h3 className="mt-2 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-muted-foreground">{s.text}</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {SHOWCASE_POINTS[i]?.map((p) => (
                  <li key={p} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{p}</li>
                ))}
              </ul>
            </div>
            <div data-reveal style={delay(2)} className="relative md:col-span-3">
              <div aria-hidden className="absolute -inset-6 rounded-3xl bg-primary/15 blur-3xl" />
              <img src={s.src} alt={s.title} loading="lazy" className="lp-angle relative mx-auto block h-auto max-h-[calc(100svh-8rem)] w-auto max-w-full rounded-xl border bg-card shadow-2xl"
                style={{ '--a': i % 2 ? '10deg' : '-10deg' } as React.CSSProperties} />
            </div>
          </div>
        ))}
      </section>

      <LandingDetails />

      <section className="relative isolate overflow-hidden px-4 py-28 text-center">
        <div aria-hidden className="lp-aurora top-1/2 left-1/2 -z-10 size-[30rem] -translate-1/2 bg-primary/30" />
        <h2 data-reveal className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">Your next answer is <span className="lp-gradient-text">one question away.</span></h2>
        <div data-reveal style={delay(2)} className="mt-10 flex justify-center">
          <Button variant="primary" size="lg" className="lp-glow rounded-full px-7" onClick={onEnter} icon={<ArrowRight className="order-last size-4" />} label={`Start with ${BRAND_NAME}`} />
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} {BRAND_NAME}</footer>
    </div>
  );
}
