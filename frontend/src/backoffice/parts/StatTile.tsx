import type { ReactNode } from 'react';
import { Card } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'bad' }) {
  return (
    <Card className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', tone === 'bad' && 'text-destructive')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export const StatGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{children}</div>
);
