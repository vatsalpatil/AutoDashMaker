import type { CSSProperties, MouseEvent } from 'react';
import { useState } from 'react';
import { greeting, todayLabel } from './recent';
import { HeroScene } from './HeroScene';

/** The big headline: greeting in display type over a 3D bar scene that leans toward the mouse. */
export function HomeHeader({ hasData }: { hasData: boolean }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 14, y: ((e.clientY - r.top) / r.height - 0.5) * -10 });
  };
  const style = { '--tilt-x': `${tilt.x}deg`, '--tilt-y': `${tilt.y}deg` } as CSSProperties;
  return (
    <header
      className="relative overflow-hidden rounded-2xl border bg-card px-6 py-8 shadow-xs sm:px-8 sm:py-10 md:min-h-64"
      style={style}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
      <HeroScene />
      <div className="relative">
        <p className="text-sm font-medium text-muted-foreground">{todayLabel()}</p>
        <h1 className="hero-title mt-1 bg-linear-to-r from-foreground via-primary to-foreground bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
          {greeting()}.
        </h1>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          {hasData ? 'Here is where your data stands today. Ask a question, or pick up where you left off.' : "Let's get your first dataset in, then you can ask it anything."}
        </p>
      </div>
    </header>
  );
}
