import type { ReactNode } from 'react';
import { Card } from '@/components/ui/kit';

/** A titled card: the building block of every backoffice page. */
export function Section({ title, description, actions, children }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}

/** Label + control row used in the settings forms. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
