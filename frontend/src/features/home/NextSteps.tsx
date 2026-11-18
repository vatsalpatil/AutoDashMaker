import { Link } from 'react-router-dom';
import { ArrowRight, Check, LayoutDashboard, MessageSquareText, Upload, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step { icon: LucideIcon; title: string; text: string; to: string; cta: string; done: boolean }

/**
 * The first-run journey (Connect → Ask → Save to a dashboard) with live progress, so a new user always sees
 * the one next thing to do. Hidden once every step is done.
 */
export function NextSteps({ datasets, charts, dashboards }: { datasets: number; charts: number; dashboards: number }) {
  const steps: Step[] = [
    { icon: Upload, title: 'Add your data', text: 'Upload a file or connect a database, API or sheet.', to: '/sources', cta: 'Add data', done: datasets > 0 },
    { icon: MessageSquareText, title: 'Ask a question', text: 'Plain English in, SQL + chart + explanation out.', to: '/ask', cta: 'Open Ask', done: charts > 0 },
    { icon: LayoutDashboard, title: 'Save to a dashboard', text: 'On an answer, press “Save as chart”, then pin it to a dashboard.', to: '/dashboards', cta: 'Dashboards', done: dashboards > 0 },
  ];
  const next = steps.findIndex((s) => !s.done);
  if (next === -1) return null;
  return (
    <section aria-label="Getting started" className="rounded-xl border bg-card shadow-xs">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Getting started</h2>
        <span className="text-xs text-muted-foreground">{next} of {steps.length} done</span>
      </header>
      <ol className="grid gap-px bg-border sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text, to, cta, done }, i) => {
          const current = i === next;
          return (
            <li key={title} className={cn('flex flex-col gap-2 bg-card p-4', current && 'bg-primary/5')}>
              <div className="flex items-center gap-2">
                <span className={cn('grid size-7 place-items-center rounded-full text-sm font-semibold',
                  done ? 'bg-success/15 text-success' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <Icon className={cn('size-4', current ? 'text-primary' : 'text-muted-foreground')} />
                {current && <span className="ml-auto text-[11px] font-medium uppercase tracking-wider text-primary">Next</span>}
              </div>
              <div className={cn('text-sm font-semibold', done && 'text-muted-foreground line-through')}>{title}</div>
              <p className="text-sm text-muted-foreground">{text}</p>
              {current && (
                <Link to={to} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{cta} <ArrowRight className="size-3.5" /></Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
