import type { CSSProperties } from 'react';
import { Play, Trophy, Zap } from 'lucide-react';
import { useCatchGame } from './useCatchGame';

/** The hero's mini game: scatter points pop up over the chart, click them before they fade (30s, combos add bonus). */
export function HeroGame() {
  const g = useCatchGame();
  const pill = 'pointer-events-auto absolute bottom-3 right-4 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-xs backdrop-blur';
  return (
    <div className="absolute inset-0">
      {g.dots.map((d) => (
        <button
          key={d.id}
          aria-label="Catch data point"
          onPointerDown={() => g.hit(d.id)}
          className="catch-dot pointer-events-auto absolute cursor-pointer rounded-full border-2 border-primary bg-primary/30"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, '--life': `${g.lifeMs}ms` } as CSSProperties}
        />
      ))}
      {g.phase === 'playing' ? (
        <div className={`${pill} tabular-nums`}>
          {g.combo > 1 && <span className="inline-flex items-center gap-0.5 font-semibold text-primary"><Zap className="size-3" />x{g.combo}</span>}
          <span>Score <b>{g.score}</b></span>
          <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Trophy className="size-3" />{g.best}</span>
          <b className="w-6 text-right">{g.left}s</b>
        </div>
      ) : (
        <button onClick={g.start} className={`${pill} font-medium transition-colors hover:border-primary hover:text-primary`}>
          <Play className="size-3 text-primary" />
          {g.phase === 'over' ? `${g.score} pts${g.score >= g.best && g.score > 0 ? ' · best!' : ''} · play again` : 'Catch the data · 30s'}
        </button>
      )}
    </div>
  );
}
