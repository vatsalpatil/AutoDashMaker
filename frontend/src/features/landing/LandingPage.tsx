import { ArrowRight } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button } from '@/components/ui/kit';
import { FEATURES, SHOTS, STEPS } from './landingContent';

/** Framed screenshot with a soft primary glow. */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div aria-hidden className="absolute -inset-4 rounded-3xl bg-primary/20 blur-3xl" />
      <img src={src} alt={alt} loading="lazy" className="relative w-full rounded-xl border bg-card shadow-2xl" />
    </div>
  );
}

/** Brand landing page: the first thing a visitor sees. `onEnter` moves them on to the app (or sign-in). */
export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const cta = (label: string) => (
    <Button variant="primary" size="lg" onClick={onEnter} icon={<ArrowRight className="order-last size-4" />} label={label} />
  );
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-lg font-semibold"><LogoIcon className="size-7" />{BRAND_NAME}</div>
          <Button variant="secondary" size="sm" onClick={onEnter} label="Open the app" />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center sm:pt-24">
        <p className="mx-auto mb-4 w-fit rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">AI-native analytics</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Ask your data anything. <span className="text-primary">See the answer.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {BRAND_NAME} turns raw files and databases into trusted answers, charts and dashboards — in plain English, no SQL required.
        </p>
        <div className="mt-8 flex justify-center">{cta('Get started')}</div>
        <Shot src={SHOTS.hero.src} alt={SHOTS.hero.alt} className="mx-auto mt-14 max-w-5xl" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">Everything from raw data to decision</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-20 px-4 py-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">See {BRAND_NAME} at work</h2>
        {SHOTS.showcase.map((s, i) => (
          <div key={s.src} className="grid items-center gap-8 md:grid-cols-5">
            <div className={`md:col-span-2 ${i % 2 ? 'md:order-last' : ''}`}>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </div>
            <Shot src={s.src} alt={s.title} className="md:col-span-3" />
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{s.n}</span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Your next answer is one question away.</h2>
        <div className="mt-8 flex justify-center">{cta(`Start with ${BRAND_NAME}`)}</div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} {BRAND_NAME}</footer>
    </div>
  );
}
