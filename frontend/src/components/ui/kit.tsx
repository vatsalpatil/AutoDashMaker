/**
 * App-level building blocks on top of shadcn/ui (Base UI flavour) and ReUI.
 *
 * The pages were written against a label/variant style API (`<Button label="Run" variant="primary" />`).
 * These wrappers keep that call style while rendering the real shadcn / ReUI primitives, so every page
 * gets the shadcn look and the active theme tokens. New code can import the primitives from
 * `@/components/ui/*` and `@/components/reui/*` directly.
 */
import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { Badge as ReBadge } from '@/components/reui/badge';
import { Button as ShButton } from '@/components/ui/button';
import { Card as ShCard } from '@/components/ui/card';
import { Collapsible as ShCollapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog as ShDialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner as ShSpinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';

const BUTTON_VARIANT = {
  primary: 'default', secondary: 'secondary', ghost: 'ghost', outline: 'outline', danger: 'destructive',
} as const;

export function Button({
  variant = 'secondary', size = 'md', label, icon, isDisabled, className, children, ...rest
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  label?: React.ReactNode;
  icon?: React.ReactNode;
  isDisabled?: boolean;
} & Omit<React.ComponentProps<typeof ShButton>, 'variant' | 'size'>) {
  return (
    <ShButton
      variant={BUTTON_VARIANT[variant]}
      size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
      disabled={isDisabled ?? rest.disabled}
      className={className}
      {...rest}
    >
      {icon}
      {label ?? children}
    </ShButton>
  );
}

// ---------------------------------------------------------------- Badge

type BadgeVariant = 'neutral' | 'blue' | 'green' | 'success' | 'red' | 'error' | 'purple' | 'info' | 'warning';

const BADGE_VARIANT = {
  neutral: 'secondary', blue: 'primary-light', green: 'success-light', success: 'success-light',
  red: 'destructive-light', error: 'destructive-light', purple: 'info-light', info: 'info-light', warning: 'warning-light',
} as const;

export function Badge({ variant = 'neutral', label, className, children }: {
  variant?: BadgeVariant;
  label?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <ReBadge variant={BADGE_VARIANT[variant] ?? 'secondary'} className={className}>
      {label ?? children}
    </ReBadge>
  );
}

// ---------------------------------------------------------------- Card

const PADDING: Record<number, string> = { 0: 'p-0', 2: 'p-2', 3: 'p-3', 4: 'p-4', 5: 'p-5', 6: 'p-6' };

export function Card({ padding = 4, className, children, ...rest }: { padding?: number } & React.ComponentProps<'div'>) {
  return (
    <ShCard className={cn('gap-0 py-0', PADDING[padding] ?? 'p-4', className)} {...rest}>
      {children}
    </ShCard>
  );
}

// ---------------------------------------------------------------- Inputs

type FieldProps = { label?: string; value: string; onChange?: (value: string) => void };

export function TextInput({ label, value, onChange, isDisabled, className, ...rest }: FieldProps & {
  isDisabled?: boolean;
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'label'>) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Input id={id} value={value} disabled={isDisabled ?? rest.disabled} className={className}
        onChange={(e) => onChange?.(e.target.value)} {...rest} />
    </div>
  );
}

export function TextArea({ label, value, onChange, isDisabled, className, ...rest }: FieldProps & {
  isDisabled?: boolean;
} & Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange' | 'label'>) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Textarea id={id} value={value} disabled={isDisabled ?? rest.disabled} className={className}
        onChange={(e) => onChange?.(e.target.value)} {...rest} />
    </div>
  );
}

// ---------------------------------------------------------------- Dialog

export function Dialog({ isOpen, onOpenChange, children, className }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ShDialog open={isOpen} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className={cn('w-auto max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-none', className)}>
        {children}
      </DialogContent>
    </ShDialog>
  );
}

// ---------------------------------------------------------------- Tabs

export function TabList({ value, onChange, children, ...rest }: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList aria-label={rest['aria-label']}>{children}</TabsList>
    </Tabs>
  );
}

export function Tab({ value, label }: { value: string; label: React.ReactNode }) {
  return <TabsTrigger value={value}>{label}</TabsTrigger>;
}

// ---------------------------------------------------------------- Collapsible

export function Collapsible({ trigger, children, defaultOpen = false }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <ShCollapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary">
        <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180 -rotate-90" />
        {trigger}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </ShCollapsible>
  );
}

// ---------------------------------------------------------------- Feedback

export function EmptyState({ title, description, isCompact = false, action }: {
  title: string;
  description?: string;
  isCompact?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-center', isCompact ? 'gap-1 p-4' : 'gap-2 p-10')}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return <ShSpinner aria-label={label ?? 'Loading'} className={size === 'sm' ? 'size-4' : size === 'lg' ? 'size-8' : 'size-6'} />;
}
