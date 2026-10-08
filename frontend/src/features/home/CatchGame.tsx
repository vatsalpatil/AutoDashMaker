import type { CSSProperties } from 'react';
import { Play, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from './Panel';
import { useCatchGame } from './useCatchGame';

/** A 30-second mini game styled as a scatter plot: catch the data points before they fade. Fills the spare space on Home. */
export function CatchGame({ className }: { className?: string }) {
  const g = useCatchGame();
  const hud = (
    <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
      {g.combo > 1 && <span className="inline-flex items-center gap-1 font-medium text-primary"><Zap className="size-3" />x{g.combo}</span>}
      <span>Score <b className="text-foreground">{g.score}</b></span>
      <span className="inline-flex items-center gap-1"><Trophy className="size-3" />{g.best}</span>
      {g.phase === 'playing' && <span className="w-8 text-right font-medium text-foreground">{g.left}s</span>}
    </div>
  );
  return (
    <Panel title="Catch the data" actions={hud} className={`flex flex-col ${className ?? ''}`}>
      <div className="catch-plot relative min-h-56 flex-1 select-none">
        <span className="absolute bottom-1 right-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">x · revenue</span>
        <span className="absolute left-3 top-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">y · customers</span>
        {g.dots.map((d) => (
          <button
            key={d.id}
            aria-label="Catch data point"
            onPointerDown={() => g.hit(d.id)}
            className="catch-dot absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-primary bg-primary/30"
            style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, '--life': `${g.lifeMs}ms` } as CSSProperties}
          />
        ))}
        {g.phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 text-center backdrop-blur-[2px]">
            {g.phase === 'over' && <p className="text-lg font-semibold">{g.score} points{g.score >= g.best && g.score > 0 ? ' · new best!' : ''}</p>}
            <p className="max-w-xs text-sm text-muted-foreground">Click the data points before they fade. Chain catches for bonus points.</p>
            <Button size="sm" onClick={g.start}><Play className="size-3.5" />{g.phase === 'over' ? 'Play again' : 'Play · 30s'}</Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
