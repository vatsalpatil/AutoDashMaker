import type { Widget } from '@/lib/types';
import { AutoLayoutBar } from '../autoLayouts';
import { BoxList, boxesOf } from '../widgetBoxes';

/** Left panel of the layout editor: one-click layouts, boxes, and every widget on the page (click to select). */
export function LayoutSidebar({ widgets, selected, nameOf, onPreset, onSelect, onSetting, onCreateBox }: {
  widgets: Widget[]; selected: Set<string>; nameOf: (w: Widget) => string;
  onPreset: (p: string) => void; onSelect: (id: string, add: boolean) => void;
  onSetting: (id: string, key: string, value: unknown) => void; onCreateBox: () => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto layout</h3>
        <AutoLayoutBar onPick={onPreset} />
      </section>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Boxes</h3>
        <BoxList boxes={boxesOf(widgets)} selected={selected} nameOf={nameOf} set={onSetting} onCreate={onCreateBox} />
      </section>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Widgets ({widgets.length})</h3>
        <ul className="space-y-0.5">
          {widgets.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={(e) => onSelect(w.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                className={`w-full truncate rounded-md px-2 py-1 text-left text-xs ${selected.has(w.id) ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}>
                {nameOf(w)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
