import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Icon-only button with a tooltip title; `danger` turns it red on hover (delete actions). */
export function IconButton({ title, danger = false, className, children, ...rest }: {
  title: string;
  danger?: boolean;
  children: ReactNode;
} & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cn(
        'rounded-md p-1 text-muted-foreground/70 transition-colors disabled:opacity-50',
        danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted hover:text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
