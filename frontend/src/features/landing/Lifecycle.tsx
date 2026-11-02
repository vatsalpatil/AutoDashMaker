import { useRef } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { LIFECYCLE } from './modulesContent';
import { useCycle } from './motion';

const STEP_MS = 2600;
const N = LIFECYCLE.length;
/** Node position on the ring, in % of the square (starts at the top, clockwise). */
const at = (i: number) => {
  const a = (-90 + (360 / N) * i) * (Math.PI / 180);
  return { left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` };
};

/** The data life cycle as a looping ring: a pulse travels the ring, each stage lights up in turn and is explained in the centre. */
export function Lifecycle() {
  const [active, pick, playing] = useCycle(N, STEP_MS);
  const s = LIFECYCLE[active];
  // the ball's angle only ever grows, so going from the last stage back to the first keeps it rolling forwards
  const ball = useRef({ last: 0, deg: 0 });
  if (active !== ball.current.last) {
    ball.current.deg += (((active - ball.current.last) % N + N) % N) * (360 / N);
    ball.current.last = active;
  }
  return (
    <section className="relative isolate overflow-hidden border-y bg-card/30 py-24">
      <div aria-hidden className="lp-aurora top-1/3 left-1/2 -z-10 size-[34rem] -translate-x-1/2 bg-primary/20" />
      <div data-reveal className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">The life cycle</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">From raw data to decisions — and back again</h2>
        <p className="mt-3 text-muted-foreground">Data is never "done". Sources refresh, checks re-run, dashboards update and alerts keep watch, so the loop keeps turning.</p>
      </div>

      {/* ring (tablet and up) */}
      <div data-reveal className="relative mx-auto mt-14 hidden aspect-square w-full max-w-[640px] sm:block">
        <svg viewBox="0 0 400 400" className="absolute inset-0 size-full" aria-hidden>
          <circle cx="200" cy="200" r="164" fill="none" stroke="var(--border)" strokeWidth="2" />
          <circle cx="200" cy="200" r="164" fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="6 10" className="lp-flow" opacity=".7" />
          {/* progress arc: grows to the active stage, synced with the highlight */}
          <circle cx="200" cy="200" r="164" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" pathLength="100"
            strokeDasharray={`${(active / N) * 100 + 0.01} 100`} transform="rotate(-90 200 200)" className="lp-pulse transition-[stroke-dasharray] duration-700" />
          {/* glowing ball rolling round the ring to the active stage */}
          <g style={{ transform: `rotate(${ball.current.deg}deg)`, transformOrigin: '200px 200px', transition: 'transform 900ms cubic-bezier(.6,0,.3,1)' }}>
            <circle cx="200" cy="36" r="14" fill="var(--primary)" opacity=".25" className="animate-ping" style={{ transformOrigin: '200px 36px' }} />
            <circle cx="200" cy="36" r="7" fill="var(--primary)" className="lp-pulse" />
            <circle cx="200" cy="36" r="3" fill="var(--primary-foreground)" />
          </g>
        </svg>
        {LIFECYCLE.map((x, i) => (
          <button key={x.title} onClick={() => pick(i)} style={at(i)}
            className={`absolute flex -translate-1/2 flex-col items-center gap-1.5 transition duration-500 ${i === active ? 'scale-110' : 'hover:scale-105'}`}>
            <span className={`flex size-14 items-center justify-center rounded-2xl border text-lg font-bold shadow-lg transition duration-500
              ${i === active ? 'border-primary bg-primary text-primary-foreground shadow-primary/40' : i < active ? 'border-primary/60 bg-card text-primary' : 'bg-card text-muted-foreground'}`}>{i + 1}</span>
            <span className={`rounded-md bg-background px-1.5 text-sm font-medium whitespace-nowrap ${i === active ? 'text-foreground' : 'text-muted-foreground'}`}>{x.title}</span>
          </button>
        ))}
        <div className="absolute inset-[24%] flex items-center justify-center text-center">
          <div key={active} className="lp-swap">
            <p className="text-xs font-medium text-primary">Stage {active + 1} of {N}</p>
            <h3 className="mt-1 text-3xl font-bold">{s.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{s.text}</p>
            <p className="mt-4 inline-block rounded-full border bg-background/70 px-3 py-1 text-xs">Where: {s.tabs}</p>
            {!playing && (
              <button onClick={() => pick(active)} className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10">
                <Play className="size-3" />Paused — click to play (resumes by itself in a few seconds)
              </button>
            )}
            {playing && active === N - 1 && <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary"><RefreshCw className="size-3.5 animate-spin" />…and the loop starts again</p>}
          </div>
        </div>
      </div>

      {/* timeline (phones) */}
      <ol className="relative mx-auto mt-10 max-w-md space-y-6 px-6 sm:hidden">
        <span aria-hidden className="absolute top-2 bottom-2 left-[2.6rem] w-px bg-gradient-to-b from-primary via-primary/40 to-primary" />
        {LIFECYCLE.map((x, i) => (
          <li key={x.title} data-reveal className="relative flex gap-4">
            <span className="z-10 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary bg-card text-sm font-bold text-primary">{i + 1}</span>
            <div><h3 className="font-semibold">{x.title}</h3><p className="text-sm text-muted-foreground">{x.text}</p><p className="mt-1 text-xs text-primary">{x.tabs}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
