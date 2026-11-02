import { useRef } from 'react';
import { Check, Database, Loader2, Sparkles, User } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { Heading } from './LandingDetails';
import { ANSWER, QUESTION, ROWS, SQL, STEPS, T, progress, typed, useLoopClock } from './aiDemoScript';

const ease = (p: number) => 1 - (1 - p) ** 3;
const money = (n: number) => `$${(n / 1e6).toFixed(2)}M`;
const Caret = ({ on }: { on: boolean }) => (on ? <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse bg-primary" /> : null);
const KEYWORDS = /\b(SELECT|SUM|AS|FROM|GROUP BY|ORDER BY|DESC)\b/g;

/** Typed SQL with keywords highlighted. */
function Code({ text }: { text: string }) {
  const parts = text.split(KEYWORDS);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="text-primary">{p}</span> : p))}</>;
}

/** Animated "AI at work" scene: a question is typed, the AI thinks through its steps, writes SQL, and builds the answer. Loops while on screen. */
export function AiDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoopClock(ref, T.end);
  const q = progress(t, T.question), sql = progress(t, T.sql), ans = progress(t, T.answer);
  const res = ease(progress(t, [T.result, T.result + 1400]));
  const running = t > T.steps[2] && t < T.result;
  const max = ROWS[0].revenue;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <Heading eyebrow="Watch the AI work" title="From a question to a finished answer"
        text={`${BRAND_NAME} reads your data, writes the query, runs it and explains the result, all in a few seconds.`} />

      <div ref={ref} data-reveal className="relative mt-12">
        <div aria-hidden className="absolute -inset-6 rounded-3xl bg-primary/15 blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full bg-muted-foreground/30" /><span className="size-2.5 rounded-full bg-muted-foreground/30" /><span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="ml-3 flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" />Ask · <Database className="size-3.5" />sales_2025</span>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.25fr]">
            {/* conversation */}
            <div className="flex flex-col gap-4 lg:min-h-[420px] border-b p-5 lg:border-r lg:border-b-0">
              <div className="ml-auto flex max-w-[90%] items-start gap-2">
                <p className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{typed(QUESTION, q) || ' '}<Caret on={q > 0 && q < 1} /></p>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"><User className="size-3.5" /></span>
              </div>

              {t > T.think && (
                <div className="lp-swap flex items-start gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"><Sparkles className="size-3.5" /></span>
                  <div className="flex-1 space-y-3">
                    <ul className="space-y-1.5 text-xs">
                      {STEPS.map((s, i) => {
                        const start = T.steps[i], done = i < 3 ? t > T.steps[i + 1] : t > T.answer[0];
                        if (t < start) return null;
                        return (
                          <li key={s} className="lp-swap flex items-center gap-2 text-muted-foreground">
                            {done ? <Check className="size-3.5 text-emerald-500" /> : <Loader2 className="size-3.5 animate-spin text-primary" />}
                            <span className={done ? '' : 'lp-shimmer-text'}>{s}</span>
                          </li>
                        );
                      })}
                      {t < T.steps[0] && <li className="flex gap-1 py-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />)}</li>}
                    </ul>
                    {ans > 0 && (
                      <p className="lp-swap rounded-2xl rounded-tl-sm border bg-background/60 px-4 py-2.5 text-sm">{typed(ANSWER, ans)}<Caret on={ans < 1} /></p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* workspace: SQL, then the result */}
            <div className="relative space-y-4 p-5">
              <div className="rounded-xl border bg-background/70 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                <div className="mb-2 font-sans text-[11px] text-muted-foreground">Generated SQL · checked read-only</div>
                {sql > 0 ? <><Code text={typed(SQL, sql)} /><Caret on={sql < 1} /></> : <span className="text-muted-foreground">Waiting for a question…</span>}
              </div>

              <div className={`relative overflow-hidden rounded-xl border bg-background/70 p-4 transition-opacity duration-500 ${t > T.result - 400 ? 'opacity-100' : 'opacity-30'}`}>
                {running && <div aria-hidden className="lp-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/25 to-transparent" />}
                <div className="grid grid-cols-3 gap-3">
                  {[['Top region', res > 0.2 ? 'West' : '—'], ['Revenue', money(max * res)], ['Lead', `+${(1.7 * res).toFixed(1)}%`]].map(([k, v]) => (
                    <div key={k} className="rounded-lg border bg-card px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">{k}</div>
                      <div className="text-lg font-semibold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2.5">
                  {ROWS.map((r, i) => (
                    <div key={r.region} className="flex items-center gap-3 text-xs">
                      <span className="w-10 text-muted-foreground">{r.region}</span>
                      <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted/50">
                        <div className="h-full rounded-md bg-gradient-to-r from-primary/60 to-primary"
                          style={{ width: `${(r.revenue / max) * 100 * ease(progress(t, [T.result + i * 150, T.result + 900 + i * 150]))}%` }} />
                      </div>
                      <span className="w-14 text-right tabular-nums">{money(r.revenue * res)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
