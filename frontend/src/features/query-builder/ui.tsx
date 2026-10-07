import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/common/SelectField';
import { cn } from '@/lib/utils';
import type { ColOpt, Ref } from './qbModel';
import { refKey } from './qbModel';

const TONES = {
  primary: 'text-primary bg-primary/10', info: 'text-info bg-info/10', success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10', destructive: 'text-destructive bg-destructive/10',
};

/** One collapsible notebook step: coloured title bar, optional "remove", body. */
export function Step({ icon, title, tone = 'primary', badge, onRemove, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; tone?: keyof typeof TONES;
  badge?: React.ReactNode; onRemove?: () => void; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center gap-2 px-3 py-2">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={cn('flex size-6 items-center justify-center rounded-md [&>svg]:size-3.5', TONES[tone])}>{icon}</span>
          <span className="truncate text-sm font-semibold">{title}</span>
          {badge}
          <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
        </button>
        {onRemove && <Button size="sm" variant="ghost" aria-label={`Remove ${title}`} icon={<Trash2 className="size-3.5" />} onClick={onRemove} />}
      </header>
      {open && <div className="flex flex-col gap-2 border-t p-3">{children}</div>}
    </section>
  );
}

/** Column picker over ColOpt[] (value = stable key). */
export function ColSelect({ cols, value, onChange, placeholder = 'Pick a column', kinds, className }: {
  cols: ColOpt[]; value: Ref | undefined; onChange: (c: ColOpt) => void; placeholder?: string; kinds?: string[]; className?: string;
}) {
  const list = kinds ? cols.filter((c) => kinds.includes(c.kind)) : cols;
  return (
    <SelectField value={refKey(value)} placeholder={placeholder} className={className} aria-label={placeholder}
      onChange={(e) => { const c = cols.find((x) => x.key === e.target.value); if (c) onChange(c); }}>
      {list.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
    </SelectField>
  );
}

export const Chips = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap items-center gap-1.5">{children}</div>;

export function NameInput({ value, onChange, placeholder, className }: { value?: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn('h-8 min-w-0', className)} />;
}

/** Row of fields with a remove button at the end. */
export function Row({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/40 p-1.5 [&>*]:min-w-[8rem] [&>*]:flex-1">
      {children}
      {onRemove && <Button size="sm" variant="ghost" aria-label="Remove" className="!min-w-0 !flex-none" icon={<Trash2 className="size-3.5" />} onClick={onRemove} />}
    </div>
  );
}

/** Helper to edit one item of a list immutably. */
export const patchAt = <T,>(list: T[] | undefined, i: number, p: Partial<T>): T[] => (list ?? []).map((x, j) => (j === i ? { ...x, ...p } : x));
export const removeAt = <T,>(list: T[] | undefined, i: number): T[] => (list ?? []).filter((_, j) => j !== i);
