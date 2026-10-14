import { GripVertical, Undo2 } from 'lucide-react';
import type { Widget } from '@/lib/types';
import { AutoLayoutBar } from '../autoLayouts';
import { BoxList, boxesOf } from '../widgetBoxes';

/** Left panel of the layout editor: one-click layouts, boxes, and every widget on the page (click to select). */
export function LayoutSidebar({ widgets, parked, selected, nameOf, onPreset, onSelect, onSetting, onCreateBox, onDragParked, onRestoreAll }: {
  widgets: Widget[]; parked: Widget[]; onDragParked: (w: Widget | null) => void; onRestoreAll: () => void; selected: Set<string>; nameOf: (w: Widget) => string;
  onPreset: (p: string) => void; onSelect: (id: string, add: boolean) => void;
  onSetting: (id: string, key: string, value: unknown) => void; onCreateBox: () => void;
}) {
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Off layout ({parked.length})</h3>
          {parked.length > 0 && <button type="button" onClick={onRestoreAll} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Undo2 className="size-3" />Put all back</button>}
        </div>
        {parked.length === 0
          ? <p className="text-xs text-muted-foreground">Widgets you take off the layout wait here. Drag one onto the canvas to place it.</p>
          : <ul className="space-y-1">
              {parked.map((w) => (
                <li key={w.id} draggable unselectable="on" title="Drag onto the canvas"
                  // Firefox needs data on the transfer for the drag to start
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); onDragParked(w); }}
                  onDragEnd={() => onDragParked(null)}
                  className="flex cursor-grab items-center gap-1.5 rounded-md border border-dashed bg-card px-2 py-1.5 text-xs hover:border-primary active:cursor-grabbing">
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{nameOf(w)}</span>
                </li>
              ))}
            </ul>}
      </section>
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
