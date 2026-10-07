import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Option { value: string; label: React.ReactNode; disabled?: boolean }

/** Pull `{value, label}` pairs out of `<option>` / `<optgroup>` children so call sites keep the native look-alike API. */
function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const el = child as React.ReactElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>;
    if (el.type === React.Fragment || el.type === 'optgroup') out.push(...readOptions(el.props.children));
    else if (el.type === 'option') {
      const label = el.props.children;
      out.push({ value: String(el.props.value ?? (typeof label === 'string' ? label : '')), label, disabled: el.props.disabled });
    }
  });
  return out;
}

export interface SelectFieldProps {
  label?: string;
  value: string;
  /** Called like a native select's onChange: `e.target.value` holds the new value. */
  onChange?: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}

/** A labelled dropdown on the ReUI/shadcn Select. Options are written as `<option>` children. */
export function SelectField({ label, value, onChange, children, disabled, className, placeholder, ...rest }: SelectFieldProps) {
  const id = React.useId();
  const options = readOptions(children);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select value={value} disabled={disabled} onValueChange={(v) => onChange?.({ target: { value: String(v ?? '') } })}>
        <SelectTrigger id={id} aria-label={rest['aria-label'] ?? label} className={cn('w-full min-w-0', className)}>
          <SelectValue placeholder={placeholder}>
            {selected ? selected.label : <span className="text-muted-foreground">{placeholder ?? 'Select…'}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="min-w-[var(--anchor-width)] w-auto">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
