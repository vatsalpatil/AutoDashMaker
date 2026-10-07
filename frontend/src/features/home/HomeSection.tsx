import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** A titled block on Home with a "View all" link: the shared frame for the recent-items rows. */
export function HomeSection({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">View all <ArrowRight className="size-3.5" /></Link>
      </div>
      {children}
    </section>
  );
}
