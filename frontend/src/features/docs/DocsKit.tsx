import { useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Info, Lightbulb, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './DocsParts';

/** Building blocks for docs pages (Mintlify-style): headings with anchors, callouts, steps, tabs, cards, tables. */

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function PageTitle({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 border-b pb-6">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-lg leading-7 text-muted-foreground">{lead}</p>
    </header>
  );
}

/** Section heading; picked up by the "On this page" list. */
export function H2({ children }: { children: string }) {
  const id = slug(children);
  return <h2 id={id} className="group mt-6 scroll-mt-24 text-2xl font-semibold tracking-tight">{children}<a href={`#${id}`} className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Link to section">#</a></h2>;
}
export function H3({ children }: { children: ReactNode }) { return <h3 className="mt-2 text-lg font-semibold">{children}</h3>; }
export function P({ children }: { children: ReactNode }) { return <p className="leading-7 text-muted-foreground [&_b]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[0.85em] [&_code]:text-foreground">{children}</p>; }

export function List({ items, ordered }: { items: ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={cn('ml-5 space-y-1.5 leading-7 text-muted-foreground [&_b]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-foreground', ordered ? 'list-decimal' : 'list-disc')}>{items.map((x, i) => <li key={i}>{x}</li>)}</Tag>;
}

const KINDS: Record<'note' | 'tip' | 'warning', { icon: LucideIcon; cls: string }> = {
  note: { icon: Info, cls: 'border-primary/30 bg-primary/5 [&_svg]:text-primary' },
  tip: { icon: Lightbulb, cls: 'border-success/30 bg-success/5 [&_svg]:text-success' },
  warning: { icon: AlertTriangle, cls: 'border-warning/40 bg-warning/5 [&_svg]:text-warning' },
};
function Box({ kind, title, children }: { kind: keyof typeof KINDS; title?: string; children: ReactNode }) {
  const { icon: Icon, cls } = KINDS[kind];
  return (
    <div className={cn('flex gap-3 rounded-xl border p-4 text-sm leading-6', cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-muted-foreground [&_b]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-foreground">{title && <b className="block text-foreground">{title}</b>}{children}</div>
    </div>
  );
}
export const Note = (p: { title?: string; children: ReactNode }) => <Box kind="note" {...p} />;
export const Tip = (p: { title?: string; children: ReactNode }) => <Box kind="tip" {...p} />;
export const Warning = (p: { title?: string; children: ReactNode }) => <Box kind="warning" {...p} />;

/** Numbered steps joined by a vertical line. */
export function Steps({ steps }: { steps: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-3.5 top-8 h-[calc(100%-2rem)] w-px bg-border" />}
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold">{i + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5"><p className="font-semibold">{s.title}</p>{s.body}</div>
        </li>
      ))}
    </ol>
  );
}

/** Tabbed alternatives (code per OS, per provider, per source type…). */
export function Tabs({ tabs }: { tabs: { label: string; body: ReactNode }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex gap-1 overflow-x-auto border-b bg-muted/40 px-2" role="tablist">
        {tabs.map((t, k) => (
          <button key={t.label} type="button" role="tab" aria-selected={i === k} onClick={() => setI(k)}
            className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm', i === k ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</button>
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">{tabs[i].body}</div>
    </div>
  );
}
export const Code = CodeBlock;

/** Card grid that links to other pages. */
export function Cards({ cards, go }: { cards: { icon: LucideIcon; title: string; text: string; to: string }[]; go: (id: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map(({ icon: Icon, title, text, to }) => (
        <button key={title} type="button" onClick={() => go(to)} className="group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary">
          <Icon className="size-5 text-primary" />
          <span className="flex items-center gap-1 font-semibold">{title}<ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></span>
          <span className="text-sm leading-6 text-muted-foreground">{text}</span>
        </button>
      ))}
    </div>
  );
}

/** Renders `backticks` inside plain strings as inline code. */
const fmt = (c: ReactNode) => typeof c !== 'string' ? c : c.split('`').map((t, i) => i % 2 ? <code key={i} className="rounded bg-muted px-1 text-xs text-foreground">{t}</code> : t);

/** Simple reference table; first column rendered as code. */
export function Table({ head, rows, code = true }: { head: string[]; rows: ReactNode[][]; code?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((c, k) => <td key={k} className={cn('px-3 py-2', k === 0 ? (code ? 'whitespace-nowrap font-mono text-xs text-foreground' : 'font-medium text-foreground') : 'text-muted-foreground')}>{fmt(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Collapsible Q&A / detail block. */
export function Accordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-y rounded-xl border">
      {items.map((x) => (
        <details key={x.q} className="group px-4 py-3">
          <summary className="cursor-pointer list-none font-medium marker:hidden after:float-right after:text-muted-foreground after:content-['+'] group-open:after:content-['−']">{x.q}</summary>
          <div className="mt-2 text-sm leading-6 text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1">{x.a}</div>
        </details>
      ))}
    </div>
  );
}
