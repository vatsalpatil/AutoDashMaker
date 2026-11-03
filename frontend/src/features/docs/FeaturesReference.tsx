import { Check } from 'lucide-react';
import { H2, P } from '@/features/guide/GuideParts';
import { MODULES } from '@/features/landing/modulesContent';

/** Reference for every tab of the app, built from the landing page's module list. */
export function FeaturesReference() {
  const groups = [...new Set(MODULES.map((m) => m.group))];
  return (
    <div className="flex flex-col gap-8">
      <div><H2>Every feature, tab by tab</H2><P>What each part of the app does and when to use it.</P></div>
      {groups.map((g) => (
        <section key={g} className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">{g}</h3>
          {MODULES.filter((m) => m.group === g).map(({ id, name, icon: Icon, tagline, what, uses, shot }) => (
            <article key={id} id={`f-${id}`} className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Icon className="size-4" /></span>
                <div><h4 className="font-semibold">{name}</h4><p className="text-xs text-muted-foreground">{tagline}</p></div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{what}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {uses.map((u) => <li key={u} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{u}</li>)}
              </ul>
              {shot && <img src={shot} alt={name} loading="lazy" className="lp-shot mt-4 w-full rounded-lg border" />}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
