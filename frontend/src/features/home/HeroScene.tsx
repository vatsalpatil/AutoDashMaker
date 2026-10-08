import type { CSSProperties } from 'react';

/** Hero art: a self-drawing line chart on a faint plot grid that tilts with the mouse, plus floating KPI cards. */
const MINI = [14, 22, 17, 30, 24, 38, 33];
const LINE = 'M0 62 C22 58 30 40 52 44 S86 70 108 48 S146 14 168 26 S200 8 228 4';

export function HeroScene() {
  return (
    <div className="hero-stage pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] md:block">
      <div aria-hidden className="hero-plot absolute inset-0 [mask-image:linear-gradient(to_right,transparent,black_35%)]" />
      <div aria-hidden className="hero-aurora -right-10 -top-24" />
      <div aria-hidden className="hero-aurora -bottom-32 right-24 opacity-20" style={{ animationDelay: '-6s' }} />
      <div aria-hidden className="hero-deck">
        <div className="hero-card right-10 top-8 h-44 w-80 p-4" style={{ transform: 'translateZ(40px)' }}>
          <svg viewBox="0 0 228 72" className="size-full overflow-visible">
            <defs>
              <linearGradient id="hg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity=".45" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="hero-area" d={`${LINE} L228 72 L0 72 Z`} fill="url(#hg)" />
            <path className="hero-line" d={LINE} pathLength={1} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle className="hero-dot" cx="228" cy="4" r="4" fill="var(--primary)" />
          </svg>
        </div>
        <div className="hero-card bottom-6 right-44 flex h-20 w-20 items-center justify-center" style={{ transform: 'translateZ(110px)', animationDelay: '-2s' }}>
          <svg viewBox="0 0 44 44" className="size-14 -rotate-90">
            <circle cx="22" cy="22" r="16" fill="none" stroke="var(--border)" strokeWidth="5" />
            <circle className="hero-donut" cx="22" cy="22" r="16" fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" style={{ '--len': 72 } as CSSProperties} />
          </svg>
        </div>
        <div className="hero-card bottom-6 right-6 h-20 w-36 p-3" style={{ transform: 'translateZ(75px)', animationDelay: '-4s' }}>
          <svg viewBox="0 0 70 40" className="size-full overflow-visible">
            {MINI.map((h, i) => (
              <rect key={i} className="hero-mini" x={i * 10} y={40 - h} width="6" height={h} rx="2" fill="var(--primary)" fillOpacity={0.45 + i * 0.08} style={{ '--d': `${0.8 + i * 0.08}s` } as CSSProperties} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
