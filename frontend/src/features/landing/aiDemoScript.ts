import { useEffect, useRef, useState, type RefObject } from 'react';

/** What the animated "AI at work" demo shows. Numbers are real: the demo sales_2025 dataset used for the screenshots. */
export const QUESTION = 'Which region had the highest revenue?';
export const SQL = 'SELECT region, SUM(revenue) AS revenue\nFROM sales_2025\nGROUP BY region\nORDER BY revenue DESC;';
export const ROWS = [
  { region: 'West', revenue: 2271399 },
  { region: 'North', revenue: 2232987 },
  { region: 'South', revenue: 2127318 },
  { region: 'East', revenue: 1984490 },
];
export const ANSWER = 'West leads with $2.27M in revenue, 1.7% ahead of North. All four regions are within 13% of each other.';
export const STEPS = ['Reading the schema · sales_2025, 6 columns', 'Writing SQL', 'Running the query · 1,500 rows', 'Choosing a chart · ranked bars'];

/** Timeline (ms from start). Everything in the demo is derived from the elapsed time, so it is deterministic and loops cleanly. */
export const T = {
  question: [300, 1900],      // typing the question
  think: 2100,                // "thinking" dots appear
  steps: [2600, 3300, 5600, 6400],   // when each step starts (ticks when the next one starts)
  sql: [3300, 5400],          // typing the SQL
  result: 6000,               // KPIs + bars start
  answer: [7200, 9400],       // typing the answer
  end: 13000,                 // hold, then loop
};

/** 0→1 progress of `t` through [from, to]. */
export const progress = (t: number, [from, to]: number[]) => Math.min(Math.max((t - from) / (to - from), 0), 1);
/** First `p` share of `text`. */
export const typed = (text: string, p: number) => text.slice(0, Math.round(text.length * p));

/** Elapsed ms of a looping timeline that only runs while `ref` is on screen; frozen at the end for reduced motion. */
export function useLoopClock(ref: RefObject<HTMLElement | null>, length: number) {
  const [t, setT] = useState(0);
  const visible = useRef(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(length - 1); return; }
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.25 });
    if (el) io.observe(el);
    let frame = 0, last = performance.now(), acc = 0;
    const tick = (now: number) => {
      if (visible.current) { acc = (acc + now - last) % length; setT(acc); }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); };
  }, [ref, length]);
  return t;
}
