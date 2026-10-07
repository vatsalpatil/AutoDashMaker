import { FileText, Globe, Link2 } from 'lucide-react';
import { Badge, Dialog } from '@/components/ui/kit';
import type { ContentKind } from './ContentDialog';
import type { Chart } from '@/lib/types';

/** Pick a saved chart to add as a widget. */
export function AddWidgetDialog({ open, charts, onPick, onContent, onClose }: {
  open: boolean;
  charts: Chart[];
  onPick: (chartId: string) => void;
  onContent: (kind: ContentKind) => void;
  onClose: () => void;
}) {
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex max-h-[32rem] w-[26rem] max-w-full flex-col gap-2 overflow-auto p-6">
        <h2 className="text-lg font-semibold">Add to dashboard</h2>
        <div className="grid grid-cols-3 gap-2">
          {([['text', 'Text', FileText], ['link', 'Link', Link2], ['iframe', 'Embed', Globe]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => onContent(k)} className="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium hover:bg-muted/40"><Icon className="size-4 text-primary" />{label} card</button>
          ))}
        </div>
        <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved charts</h3>
        {charts.length === 0 && <p className="text-sm text-muted-foreground">No charts available. Create charts first.</p>}
        {charts.map((c) => (
          <button key={c.id} onClick={() => onPick(c.id)}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/40">
            <span>{c.name}</span>
            <Badge variant="purple" label={c.spec.type} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
