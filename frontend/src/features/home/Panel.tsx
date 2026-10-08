import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The card frame every Home block shares: a small title row (optionally a link or actions) over its content. */
export function Panel({ title, to, linkLabel = 'View all', actions, className, children }: {
  title: string; to?: string; linkLabel?: string; actions?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs', className)}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
        {to && <Link to={to} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">{linkLabel} <ArrowRight className="size-3" /></Link>}
      </header>
      {children}
    </section>
  );
}
