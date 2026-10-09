import type { ReactNode } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PreviewOption { value: string; label: string; swatch?: ReactNode }
export interface PreviewGroup { label?: string; options: PreviewOption[] }

/** Dropdown that previews each option on the whole page while hovering/arrowing through it (`onPreview(null)` = back to the saved value). */
export function PreviewSelect({ label, value, groups, onChange, onPreview }: {
  label: string;
  value: string;
  groups: PreviewGroup[];
  onChange: (value: string) => void;
  onPreview: (value: string | null) => void;
}) {
  const current = groups.flatMap((g) => g.options).find((o) => o.value === value);
  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-2">
        <div className="w-56">
          <Select value={value} onValueChange={(v) => v != null && onChange(String(v))} onOpenChange={(open) => { if (!open) onPreview(null); }}>
            <SelectTrigger aria-label={label} className="w-full">
              <SelectValue>{current && <>{current.swatch}{current.label}</>}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-72">
              {groups.map((g, i) => (
                <SelectGroup key={g.label ?? i}>
                  {g.label && <SelectLabel>{g.label}</SelectLabel>}
                  {g.options.map((o) => (
                    <SelectItem key={o.value} value={o.value} onMouseEnter={() => onPreview(o.value)} onFocus={() => onPreview(o.value)}>
                      {o.swatch}{o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
