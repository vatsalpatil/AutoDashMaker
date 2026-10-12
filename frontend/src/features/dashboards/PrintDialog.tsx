import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button, Dialog } from '@/components/ui/kit';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import { PAPER_LABEL, type Paper, type PrintOptions } from './printLayout';

/** Pick the paper before printing. The sheet is scaled to the paper, so the whole dashboard width always fits. */
export function PrintDialog({ open, pageCount, onClose, onPrint }: { open: boolean; pageCount: number; onClose: () => void; onPrint: (o: PrintOptions) => void }) {
  const [saved, setSaved] = useLocalStorage<PrintOptions>('dashboard.print', { paper: 'a4', landscape: false });
  const [paper, setPaper] = useState<Paper>(saved.paper);
  const [landscape, setLandscape] = useState(saved.landscape);
  const choice = (active: boolean) => cn('rounded-lg border px-3 py-2 text-sm font-medium transition-colors', active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent');
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[26rem] max-w-full flex-col gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Printer className="size-5 text-primary" /> Print or save as PDF</h2>
          <p className="text-sm text-muted-foreground">Prints all {pageCount} page{pageCount === 1 ? '' : 's'} of this dashboard, scaled to fit the paper width. Choose “Save as PDF” in the next window to get a file.</p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Paper size</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Paper size">
            {(Object.keys(PAPER_LABEL) as Paper[]).map((p) => <button key={p} type="button" role="radio" aria-checked={paper === p} className={choice(paper === p)} onClick={() => setPaper(p)}>{PAPER_LABEL[p]}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Orientation</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Orientation">
            {([['Portrait', false], ['Landscape', true]] as const).map(([label, v]) => <button key={label} type="button" role="radio" aria-checked={landscape === v} className={choice(landscape === v)} onClick={() => setLandscape(v)}>{label}</button>)}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" label="Cancel" onClick={onClose} />
          <Button variant="primary" label="Print" icon={<Printer className="size-4" />} onClick={() => { const o = { paper, landscape }; setSaved(o); onPrint(o); }} />
        </div>
      </div>
    </Dialog>
  );
}
