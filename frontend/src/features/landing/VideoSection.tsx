import { useEffect, useRef } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { Heading } from './LandingDetails';

/** Screen recordings of the real app, served from public/videos/ (see its README). */
const LOOPS = [
  { id: 'profile-a-dataset', title: 'Understand a dataset', text: 'Open any dataset to see every column profiled, preview rows and run quality checks.' },
  { id: 'sql-workbench', title: 'Query in the Workbench', text: 'Write SQL with autocomplete, run it, and get results in milliseconds.' },
  { id: 'chart-editor', title: 'Switch chart types', text: 'Try bar, area, treemap, funnel or donut with one click — the preview updates live.' },
  { id: 'dashboard', title: 'Explore a dashboard', text: 'KPIs, trends and breakdowns on one page, ready to present or share.' },
];

/** Silent looping clip that only downloads and plays while on screen (behaves like a GIF, ~100 KB each). */
function Loop({ id }: { id: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void v.play().catch(() => {}); else v.pause(); }, { threshold: 0.3 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={`/videos/loops/${id}.mp4`} poster={`/videos/loops/${id}.jpg`} muted loop playsInline preload="none"
    className="lp-shot aspect-[1280/800] w-full rounded-t-2xl bg-card object-cover" aria-hidden />;
}

/** "Watch it work": short silent clips recorded in the app, one task each. */
export function VideoSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <Heading eyebrow="Watch it work" title={`See ${BRAND_NAME} in action`}
        text="Short clips recorded in the real app, each showing one everyday task." />

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {LOOPS.map((l, i) => (
          <figure key={l.id} data-reveal style={{ '--d': `${i * 0.08}s` } as React.CSSProperties} className="overflow-hidden rounded-2xl border bg-card shadow-lg">
            <Loop id={l.id} />
            <figcaption className="p-5">
              <span className="text-xs font-medium text-primary">0{i + 1}</span>
              <h3 className="mt-1 font-semibold">{l.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{l.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
