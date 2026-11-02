import { Check } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { MODULES } from './modulesContent';
import { useCycle } from './motion';

const GROUPS = ['Work', 'Govern', 'Help', 'Extras'] as const;

/** Every tab of the app: a sidebar like the real one on the left, the selected tab explained on the right (auto-plays until clicked). */
export function ProductExplorer() {
  const [active, pick, playing] = useCycle(MODULES.length, 6000, 15000);
  const m = MODULES[active];
  const Icon = m.icon;
  return (
    <section id="lp-tour" className="mx-auto max-w-6xl px-4 py-24">
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Every tab, explained</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">One platform, {MODULES.length} tools that work together</h2>
        <p className="mt-3 text-muted-foreground">{BRAND_NAME} is more than upload-and-chart. Click any tab to see what it does and when you would use it.</p>
      </div>

      <div data-reveal className="mt-12 grid overflow-hidden rounded-2xl border bg-card/60 shadow-2xl backdrop-blur md:grid-cols-[230px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b p-3 md:flex-col md:overflow-visible md:border-r md:border-b-0">
          {GROUPS.map((g) => (
            <div key={g} className="contents md:block">
              <div className="hidden px-2 pt-3 pb-1 text-xs text-muted-foreground md:block">{g}</div>
              {MODULES.map((x, i) => x.group === g && (
                <button key={x.id} onClick={() => pick(i)}
                  className={`relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition md:w-full
                    ${i === active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <x.icon className="size-4 shrink-0" />{x.name}
                  {i === active && playing && <span key={active} className="lp-progress absolute bottom-0 left-0 h-0.5 bg-primary" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div key={m.id} className="lp-swap grid content-start gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 text-primary ring-1 ring-primary/30">
              <Icon className="size-7" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{m.group}</p>
              <h3 className="text-2xl font-semibold">{m.name}</h3>
              <p className="text-primary">{m.tagline}</p>
            </div>
          </div>
          <p className="text-muted-foreground">{m.what}</p>
          <div>
            <p className="mb-3 text-sm font-medium">Use it to…</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {m.uses.map((u, i) => (
                <div key={u} className="lp-swap flex gap-2 rounded-xl border bg-background/60 p-3 text-sm" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />{u}
                </div>
              ))}
            </div>
          </div>
          {!m.shot && (
            <div className="lp-swap relative grid h-56 place-items-center overflow-hidden rounded-xl border bg-gradient-to-br from-primary/20 via-card to-background" style={{ animationDelay: '.2s' }}>
              <div aria-hidden className="lp-floor opacity-60" />
              <Icon className="relative size-24 text-primary drop-shadow-[0_0_30px_var(--primary)]" style={{ animation: 'lp-bob 6s ease-in-out infinite' }} />
            </div>
          )}
          {m.shot && <img src={m.shot} alt={`${m.name} screen`} loading="lazy" className="lp-shot lp-swap max-h-[48svh] w-full rounded-xl border object-cover object-top-left shadow-xl" style={{ animationDelay: '.2s' }} />}
        </div>
      </div>
    </section>
  );
}
