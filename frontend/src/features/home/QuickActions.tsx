import { Link } from 'react-router-dom';
import { QUICK_ACTIONS } from './homeModel';

export function QuickActions() {
  return (
    <section aria-label="Get started" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {QUICK_ACTIONS.map(({ to, title, text, icon: Icon }) => (
        <Link key={to} to={to}
          className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-sm text-muted-foreground">{text}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
