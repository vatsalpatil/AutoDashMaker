import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUp, Check, Lightbulb, RotateCw, Sparkles, Undo2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { AttachImageButton, AttachmentTray, MessageImages } from '@/features/ai/attachments/Attachments';
import { useImageAttachments } from '@/features/ai/attachments/useImageAttachments';
import { AiRunLog } from './ai/AiRunLog';
import { useAiRun, type OpLine } from './ai/useAiRun';

interface EditDone { message: string; applied: string[]; skipped: { title: string; reason: string }[]; page?: string; next: string[]; can_undo: boolean }
interface Turn { instruction: string; images?: string[]; result?: EditDone; ops: OpLine[]; error?: string; noProvider?: boolean; undone?: boolean }

const STEPS = ['Reading the dashboard', 'Planning the change', 'Applying and checking', 'Verifying the result'];
const IDEAS = ['Add KPIs for the headline totals in one row', 'Add a monthly trend after the KPIs', 'Change the pie to a bar chart and make it wider',
  'Add a notes box at the top summarising the dashboard', 'Add a new page "Details" with a table of the top 20 rows'];

/** Chat with the dashboard: the AI plans the change, applies it with every query checked and self-reviewed, verifies the layout, and can undo. */
export function DashboardAiPanel({ open, dashboardId, activePage, onClose, onChanged }: {
  open: boolean;
  dashboardId: string;
  /** The page being viewed: new widgets go there. */
  activePage?: string;
  onClose: () => void;
  onChanged: (page?: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<{ text: string; images: string[] } | null>(null);
  const att = useImageAttachments();
  const [text, setText] = useState('');
  const run = useAiRun<EditDone>();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns, run.steps, run.ops]);

  async function send(instruction: string) {
    const images = att.take();
    const t = instruction.trim() || (images.length ? 'Change the dashboard to match the attached image(s).' : '');
    if (!t || run.busy) return;
    setText('');
    setPending({ text: t, images });
    // the earlier turns, so "it" / "that chart" in a follow-up make sense
    const history = turns.flatMap((x) => [{ role: 'user', text: x.instruction },
      ...(x.result ? [{ role: 'assistant', text: [x.result.message, ...x.result.applied].filter(Boolean).join(' — ') }] : [])]);
    const { done: r, ops, error } = await run.run(`/api/dashboards/${dashboardId}/ai-edit/stream`, { instruction: t, history, page: activePage, images });
    setPending(null);
    setTurns((all) => [...all, { instruction: t, images, result: r ?? undefined, ops, error: error?.message, noProvider: error?.noProvider }]);
    if (r?.applied.length) onChanged(r.page);
  }

  async function undo(i: number) {
    await api.post(`/dashboards/${dashboardId}/ai-edit/undo`);
    setTurns((all) => all.map((x, k) => (k === i ? { ...x, undone: true } : x)));
    onChanged();
  }

  const last = turns.length - 1;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-[28rem] flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Edit with AI</SheetTitle>
          <SheetDescription>Add, change, move, resize or remove widgets, add notes and pages, rename. Every query is checked and self-reviewed; you can undo.</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {turns.length === 0 && !pending && (
            <div className="flex flex-col gap-1.5">
              {IDEAS.map((i) => <button key={i} type="button" onClick={() => send(i)} className="rounded-lg border bg-card px-3 py-1.5 text-left text-sm hover:border-primary hover:text-primary">{i}</button>)}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <MessageImages images={t.images} className="ml-auto" />
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground">{t.instruction}</div>
              {t.error && (
                <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                  {t.error}{t.noProvider && <> <Link to="/settings" className="underline">Open Settings</Link></>}
                </p>
              )}
              {t.result && (
                <div className="rounded-lg border bg-muted/40 p-2.5 text-sm">
                  <p>{t.result.message}</p>
                  {t.ops.map((o, k) => (
                    <p key={k} className="mt-1 flex items-start gap-1.5 text-xs">
                      {o.op === 'retry' ? <RotateCw className="mt-0.5 size-3.5 shrink-0 text-primary" /> : o.status === 'ok' ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />}
                      <span>{o.text}{o.detail && <span className="text-muted-foreground"> — {o.detail}</span>}</span>
                    </p>
                  ))}
                  {i === last && t.result.can_undo && !t.undone && (
                    <button type="button" onClick={() => undo(i)} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"><Undo2 className="size-3.5" /> Undo this change</button>
                  )}
                  {t.undone && <p className="mt-2 text-xs text-muted-foreground">Undone — the dashboard is back as it was.</p>}
                  {i === last && t.result.next.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Lightbulb className="size-3.5" /> Next ideas</p>
                      {t.result.next.map((n) => <button key={n} type="button" onClick={() => send(n)} disabled={run.busy}
                        className="rounded-md border bg-card px-2 py-1 text-left text-xs hover:border-primary hover:text-primary">{n}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex flex-col gap-2">
              <MessageImages images={pending.images} className="ml-auto" />
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground">{pending.text}</div>
              <div className="rounded-lg border p-2"><AiRunLog run={run} titles={STEPS} compact /></div>
            </div>
          )}
          <div ref={end} />
        </div>

        <div className="border-t p-3">
          <AttachmentTray att={att} className="mb-2" />
          <div onDrop={att.dropProps.onDrop} onDragOver={att.dropProps.onDragOver} className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring/40">
            <AttachImageButton att={att} disabled={run.busy} />
            <textarea value={text} rows={2} onChange={(e) => setText(e.target.value)} onPaste={att.dropProps.onPaste} placeholder="e.g. add a bar chart of profit by country after the KPIs"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
              className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground" />
            {run.busy
              ? <button type="button" onClick={run.stop} className="h-8 shrink-0 rounded-full border px-3 text-xs">Stop</button>
              : <button type="button" onClick={() => send(text)} disabled={!text.trim() && !att.images.length} aria-label="Send"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-4" /></button>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
