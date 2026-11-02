import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { Heading } from './LandingDetails';

/** Screen recordings of the real app, served from public/videos/ (see its README). */
const TOUR = { src: '/videos/dashtor-tour.mp4', poster: '/videos/dashtor-tour.jpg' };
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
    className="aspect-[1280/800] w-full rounded-t-2xl bg-card object-cover" aria-hidden />;
}

/** "Watch it work": the narrated product tour, then short silent clips explaining one task each. */
export function VideoSection() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <Heading eyebrow="Watch it work" title={`See ${BRAND_NAME} in action`}
        text="A two-minute narrated tour recorded in the real app, then short clips that show one task each." />

      <div data-reveal className="relative mx-auto mt-12 max-w-5xl">
        <div aria-hidden className="absolute -inset-6 rounded-3xl bg-primary/20 blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <video ref={video} src={TOUR.src} poster={TOUR.poster} controls={started} preload="none" playsInline
            className="aspect-[1280/800] w-full" onPlay={() => setStarted(true)} />
          {!started && (
            <button onClick={() => { setStarted(true); void video.current?.play(); }} aria-label="Play the product tour (with sound)"
              className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/30 backdrop-blur-[2px] transition hover:bg-background/20">
              <span className="relative flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/50 transition group-hover:scale-110">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                <Play className="relative ml-1 size-8 fill-current" />
              </span>
              <span className="rounded-full border bg-card/80 px-4 py-1.5 text-sm backdrop-blur">Watch the tour · 1:48 · with voice-over</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
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
