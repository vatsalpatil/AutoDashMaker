import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SelectField } from '@/components/common/SelectField';
import { OptionsPanel } from '@/features/charts/panels/OptionsPanel';
import { kindOf } from '@/features/charts/chartKinds';
import type { Chart, Widget } from '@/lib/types';

interface Props {
  widget: Widget;
  chart: Chart | null;
  onChange: (key: string, value: unknown) => void;
  onClose: () => void;
}

/**
 * Per-widget overrides: a title plus every chart option. The chart's own options show through; anything the
 * user changes here applies to this widget only (stored in `widget.settings`).
 */
export function WidgetSettingsPanel({ widget, chart, onChange, onClose }: Props) {
  const settings = widget.settings ?? {};
  const type = chart?.spec.type ?? 'table';
  const title = typeof settings.title === 'string' ? settings.title : '';
  const resetAll = () => Object.keys(settings).forEach((k) => { if (k !== 'title' && k !== 'titleSize') onChange(k, undefined); });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[22rem] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>{chart?.name ?? `Chart #${widget.chart_id}`}</SheetTitle>
          <SheetDescription>{kindOf(type).label} widget — changes apply to this widget only.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 border-b p-3">
          <div className="flex flex-col gap-1.5">
            <Label className="font-normal text-muted-foreground">Widget title</Label>
            <Input className="h-8" value={title} placeholder={chart?.name ?? 'Widget title'} onChange={(e) => onChange('title', e.target.value)} />
          </div>
          <SelectField label="Title size" value={String(settings.titleSize ?? 'md')} onChange={(e) => onChange('titleSize', e.target.value)}>
            <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option>
          </SelectField>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <OptionsPanel type={type} options={{ ...chart?.spec.options, ...settings }} onChange={onChange} onReset={resetAll} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
