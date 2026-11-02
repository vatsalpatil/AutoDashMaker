import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/kit';
import { SHOTS } from './landingContent';
import { Scene3D } from './Scene3D';

/** Small glassy card that floats in front of the hero screenshot (3D depth via translateZ). */
function Chip({ className, delay, children }: { className: string; delay: string; children: React.ReactNode }) {
  return (
    <div className={`lp-float hidden rounded-xl border bg-card/80 px-4 py-3 shadow-2xl backdrop-blur md:block ${className}`} style={{ '--d': delay } as React.CSSProperties}>
      {children}
    </div>
  );
}

/** Hero: a morphing 3D orb behind the headline, staggered headline, tilted screenshot that flattens on scroll, floating chips. */
export function Hero3D({ onEnter }: { onEnter: () => void }) {
  const rise = (d: number) => ({ '--d': `${d}s` }) as React.CSSProperties;
  return (
    <section className="relative isolate overflow-hidden">
      {/* one decorative 3D orb behind the headline (three.js, see dataScene.ts) */}
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -z-10 aspect-square w-[min(1800px,230vw)] -translate-x-1/2 -translate-y-[35%] opacity-75">
        <Scene3D />
      </div>
      <div aria-hidden className="absolute inset-x-0 top-[38%] -z-10 h-[40%] bg-gradient-to-b from-transparent via-background/80 to-background" />

      <div className="mx-auto max-w-6xl px-4 pt-16 text-center sm:pt-24">
        <p className="lp-rise mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur" style={rise(0)}>
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative size-2 rounded-full bg-primary" /></span>
          AI-native analytics
        </p>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-7xl">
          <span className="lp-rise block" style={rise(0.1)}>Ask your data anything.</span>
          <span className="lp-rise lp-gradient-text block pb-2" style={rise(0.25)}>See the answer.</span>
        </h1>
        <p className="lp-rise mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg" style={rise(0.4)}>
          {BRAND_NAME} turns raw files and databases into trusted answers, charts and dashboards — in plain English, no SQL required.
        </p>
        <div className="lp-rise mt-9 flex justify-center gap-3" style={rise(0.55)}>
          <Button variant="primary" size="lg" className="lp-glow rounded-full px-6" onClick={onEnter} icon={<ArrowRight className="order-last size-4" />} label="Get started" />
        </div>

        <div className="lp-stage lp-rise relative mx-auto mt-16 pb-16" style={rise(0.7)}>
          {/* sized by the screen's height too, so the whole screenshot is always visible */}
          <div className="lp-hero-shot relative mx-auto w-fit">
            <div aria-hidden className="absolute -inset-4 rounded-3xl bg-primary/15 blur-3xl" />
            <img src={SHOTS.hero.src} alt={SHOTS.hero.alt} className="relative block h-auto max-h-[calc(100svh-6rem)] w-auto max-w-full rounded-xl border bg-card shadow-2xl" />
            <Chip className="-left-10 top-24 text-left" delay="0s">
              <div className="text-xs text-muted-foreground">Revenue</div>
              <div className="flex items-center gap-2 text-xl font-semibold">$8.6M <span className="flex items-center text-xs text-emerald-500"><TrendingUp className="size-3" />12%</span></div>
            </Chip>
            <Chip className="-right-12 top-10 max-w-60 text-left" delay="-2s">
              <div className="flex items-center gap-1.5 text-xs text-primary"><Sparkles className="size-3.5" />Ask</div>
              <div className="mt-1 text-sm">“Which region grew fastest this quarter?”</div>
            </Chip>
            <Chip className="-right-8 bottom-24 text-left" delay="-4s">
              <div className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-emerald-500" />Data quality <b>98%</b></div>
            </Chip>
          </div>
        </div>
      </div>
    </section>
  );
}
