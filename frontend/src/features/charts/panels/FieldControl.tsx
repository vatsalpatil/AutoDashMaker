import { X } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/reui/number-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { opt } from '../format';
import type { Field } from '../optionSchema';

const SWATCHES = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b'];

/** One option rendered with the right control for its kind. `value` is the raw (possibly unset) option. */
export function FieldControl({ field, value, fallback, onChange }: {
  field: Field;
  value: unknown;
  /** Default shown when the option is unset. */
  fallback: unknown;
  onChange: (v: unknown) => void;
}) {
  const shown = value === undefined ? fallback : value;

  if (field.kind === 'switch') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className="font-normal text-muted-foreground">{field.label}</Label>
        <Switch checked={opt.bool(shown, false)} onCheckedChange={(c) => onChange(c)} aria-label={field.label} />
      </div>
    );
  }

  if (field.kind === 'select') {
    return (
      <SelectField label={field.label} value={String(shown ?? field.options?.[0]?.[0] ?? '')} onChange={(e) => onChange(e.target.value)}>
        {field.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </SelectField>
    );
  }

  if (field.kind === 'slider') {
    const n = opt.num(shown, field.min ?? 0);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="font-normal text-muted-foreground">{field.label}</Label>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{n}</span>
        </div>
        <Slider value={[n]} min={field.min} max={field.max} step={field.step}
          onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)} aria-label={field.label} />
      </div>
    );
  }

  if (field.kind === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="font-normal text-muted-foreground">{field.label}</Label>
        <NumberField size="sm" value={value === undefined || value === '' ? null : opt.num(value, 0)}
          onValueChange={(v) => onChange(v === null ? undefined : v)}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput placeholder={field.placeholder} />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      </div>
    );
  }

  if (field.kind === 'color') {
    const hex = typeof shown === 'string' && /^#[0-9a-f]{6}$/i.test(shown) ? shown : '#6366f1';
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="font-normal text-muted-foreground">{field.label}</Label>
          {value ? <button type="button" onClick={() => onChange(undefined)} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"><X className="size-3" /> Reset</button> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => onChange(c)} style={{ background: c }}
              className={`size-5 rounded-full ring-offset-2 ring-offset-background transition hover:scale-110 ${shown === c ? 'ring-2 ring-foreground' : ''}`} />
          ))}
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour"
            className="size-6 cursor-pointer rounded border bg-transparent p-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-normal text-muted-foreground">{field.label}</Label>
      <Input value={typeof shown === 'string' ? shown : ''} placeholder={field.placeholder} className="h-8"
        onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}
