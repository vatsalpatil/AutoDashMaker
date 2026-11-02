import { Check } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { Scene3D } from './Scene3D';

const POINTS = [
  'Millions of rows crunched in seconds by an in-process DuckDB engine',
  'Every bar, line and number recalculates the moment your data refreshes',
  'AI at the core: it reads your schema, writes the query and explains the result',
];

/** "New dimension" section: text on the left, the live three.js scene on the right. */
export function Section3D() {
  return (
    <section className="relative isolate overflow-hidden py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
        <div data-reveal>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Live in 3D</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-5xl">Your data, in a <span className="lp-gradient-text">new dimension</span></h2>
          <p className="mt-4 text-muted-foreground">
            Under the hood, {BRAND_NAME} is a fast analytics engine with an AI core. Every chart you see is computed from your real data, live.
          </p>
          <ul className="mt-6 space-y-3">
            {POINTS.map((p) => <li key={p} className="flex gap-2.5 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{p}</li>)}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">Move your mouse to look around.</p>
        </div>
        <div data-reveal className="relative aspect-square w-full">
          <div aria-hidden className="absolute inset-[18%] rounded-full bg-primary/20 blur-3xl" />
          <Scene3D className="relative" />
        </div>
      </div>
    </section>
  );
}
