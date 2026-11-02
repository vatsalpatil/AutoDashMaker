import { Check, ChevronDown, Upload } from 'lucide-react';
import { AUDIENCES, FAQ, TRUST, UPLOAD_LIMITS, UPLOAD_RULES } from './landingInfo';
import { tilt } from './motion';

const delay = (i: number) => ({ '--d': `${i * 0.08}s` }) as React.CSSProperties;

export function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div data-reveal className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{text}</p>
    </div>
  );
}

/** Lower half of the landing page: who it's for, security & trust, FAQ. */
export function LandingDetails() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-24">
        <Heading eyebrow="Who it's for" title="Built for every role on your team" text="One place where business users, analysts and engineers work from the same trusted numbers." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, title, text, points }, i) => (
            <div key={title} data-reveal style={delay(i * 2)}>
              <div className="lp-tilt h-full rounded-2xl border bg-gradient-to-b from-card to-background p-7" {...tilt}>
                <Icon className="lp-pop size-8 text-primary" />
                <h3 className="lp-pop mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {points.map((p) => <li key={p} className="flex items-center gap-2"><Check className="size-4 text-primary" />{p}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Heading eyebrow="Security & trust" title="Answers you can rely on" text="Speed is nothing without trust. Every part of the platform is built to keep your data safe and your numbers explainable." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, text }, i) => (
              <div key={title} data-reveal style={delay(i)} className={i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}>
                <div className={`lp-tilt flex h-full flex-col rounded-2xl border bg-card p-5 ${i === 0 ? 'justify-end bg-gradient-to-br from-primary/20 to-card lg:p-8' : ''}`} {...tilt}>
                  <Icon className={`lp-pop text-primary ${i === 0 ? 'size-12' : 'size-5'}`} />
                  <h3 className={`lp-pop mt-3 font-semibold ${i === 0 ? 'text-2xl' : ''}`}>{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24">
        <Heading eyebrow="Upload limits & rules" title="What you can bring, and how much" text="Clear limits keep the platform fast and fair for everyone. These are the defaults for each account." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UPLOAD_LIMITS.map((l, i) => (
            <div key={l.label} data-reveal style={delay(i)}>
              <div className="lp-tilt h-full rounded-2xl border bg-card p-6 text-center" {...tilt}>
                <div className="lp-pop lp-gradient-text text-4xl font-bold">{l.value}</div>
                <div className="lp-pop mt-1 font-medium">{l.label}</div>
                <p className="mt-2 text-xs text-muted-foreground">{l.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div data-reveal className="mt-6 rounded-2xl border bg-card/60 p-6 sm:p-8">
          <h3 className="flex items-center gap-2 font-semibold"><Upload className="size-5 text-primary" />Upload rules</h3>
          <ul className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            {UPLOAD_RULES.map((r) => <li key={r} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span className="text-muted-foreground">{r}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-24">
        <Heading eyebrow="FAQ" title="Questions, answered" text="Everything you need to know before you start." />
        <div className="mt-10 space-y-3">
          {FAQ.map(({ q, a }, i) => (
            <details key={q} data-reveal style={delay(i)} className="group rounded-xl border bg-card px-5 py-4 open:border-primary/40">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {q}<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
