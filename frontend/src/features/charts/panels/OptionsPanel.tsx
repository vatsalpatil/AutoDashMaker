import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/kit';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChartType } from '@/lib/types';
import type { Opts } from '../format';
import { DEFAULTS, TABS, normalizeOptions, sectionsFor } from '../optionSchema';
import { FieldControl } from './FieldControl';

/**
 * Schema-driven editor for a chart's (or dashboard widget's) options. Only the options that apply to
 * `type` are shown, grouped into Style / Axes / Labels / Data tabs. `options` holds just the user's overrides.
 */
export function OptionsPanel({ type, options, onChange, onReset }: {
  type: ChartType;
  options: Opts;
  onChange: (key: string, value: unknown) => void;
  onReset?: () => void;
}) {
  const tabs = TABS.map((t) => ({ ...t, shown: sectionsFor(t, type) })).filter((t) => t.shown.length > 0);
  const [tab, setTab] = useState('style');
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const o = { ...DEFAULTS, ...normalizeOptions(options) };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <Tabs value={current?.id} onValueChange={(v) => setTab(String(v))} className="min-w-0 flex-1">
          <TabsList className="w-full">{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        {onReset && <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={onReset} title="Reset all options" aria-label="Reset options" />}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
        {current?.shown.map((section) => (
          <section key={section.id} className="flex flex-col gap-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{section.label}</h4>
            {section.fields.filter((f) => !f.when || f.when(o)).map((f) => (
              <FieldControl key={f.key} field={f} value={options[f.key]} fallback={o[f.key]} onChange={(v) => onChange(f.key, v)} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
