import { Dialog } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { kindOf } from '../chartKinds';
import { TEMPLATES, type ChartTemplate } from '../templates';

/** Pick a ready-made look (type + options); the studio keeps the current data mapping where it can. */
export function TemplateGallery({ open, onClose, onPick, current }: {
  open: boolean;
  onClose: () => void;
  onPick: (t: ChartTemplate) => void;
  current: string;
}) {
  const groups = [...new Set(TEMPLATES.map((t) => t.group))];
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex max-h-[80vh] w-[min(52rem,calc(100vw-2rem))] flex-col">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Chart templates</h2>
          <p className="text-sm text-muted-foreground">Start from a ready-made look, then fine-tune every option on the right.</p>
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto p-5">
          {groups.map((g) => (
            <section key={g}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.filter((t) => t.group === g).map((t) => {
                  const Icon = kindOf(t.type).icon;
                  return (
                    <button key={t.id} type="button" onClick={() => { onPick(t); onClose(); }}
                      className={cn('flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5', current === t.id && 'border-primary')}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{t.name}</span>
                        <span className="block text-xs text-muted-foreground">{t.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
