import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export interface Dot { id: number; x: number; y: number; size: number; born: number }
export type Phase = 'idle' | 'playing' | 'over';

const SPAWN_MS = 600;
const LIFE_MS = 1800;
const MAX_DOTS = 6;

/** "Catch the data" round: dots appear at random points of a scatter area, click them before they fade. Combos add bonus. */
export function useCatchGame(seconds = 30) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dots, setDots] = useState<Dot[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(seconds);
  const [best, setBest] = useLocalStorage('home.catch.best', 0);
  const nextId = useRef(0);

  const start = useCallback(() => { setScore(0); setCombo(0); setLeft(seconds); setDots([]); setPhase('playing'); }, [seconds]);

  const hit = useCallback((id: number) => {
    setDots((d) => d.filter((x) => x.id !== id));
    setScore((s) => s + 1 + Math.min(combo, 4));
    setCombo((c) => c + 1);
  }, [combo]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const spawn = setInterval(() => setDots((d) => d.length >= MAX_DOTS ? d : [...d, {
      id: nextId.current++, x: 6 + Math.random() * 88, y: 10 + Math.random() * 78, size: 22 + Math.random() * 16, born: Date.now(),
    }]), SPAWN_MS);
    const prune = setInterval(() => setDots((d) => {
      const alive = d.filter((x) => Date.now() - x.born < LIFE_MS);
      if (alive.length < d.length) setCombo(0); // a missed point breaks the streak
      return alive.length < d.length ? alive : d;
    }), 200);
    const clock = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => { clearInterval(spawn); clearInterval(prune); clearInterval(clock); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && left <= 0) { setPhase('over'); setDots([]); setBest((b) => Math.max(b, score)); }
  }, [phase, left, score, setBest]);

  return { phase, dots, score, combo, left, best, start, hit, lifeMs: LIFE_MS };
}
