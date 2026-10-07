import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Check, Loader2, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api';

interface EditResult {
  status: 'ok' | 'no_provider' | 'failed';
  detail?: string;
  message?: string;
  applied?: string[];
  skipped?: { title: string; reason: string }[];
}
interface Turn { instruction: string; result?: EditResult; error?: string }

const IDEAS = ['Add a KPI for the total', 'Change the line chart to an area chart', 'Add a pie of the top categories', 'Remove the table'];

/** Chat with the dashboard: describe a change, the AI adds / updates / removes widgets (each query is checked first). */
export function DashboardAiPanel({ open, dashboardId, onClose, onChanged }: {
  open: boolean;
  dashboardId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns, busy]);

  async function send(instruction: string) {
    const t = instruction.trim();
    if (!t || busy) return;
    setText('');
    setBusy(true);
    setTurns((all) => [...all, { instruction: t }]);
    const patch = (p: Partial<Turn>) => setTurns((all) => all.map((x, i) => (i === all.length - 1 ? { ...x, ...p } : x)));
    try {
      const r = await api.post<EditResult>(`/dashboards/${dashboardId}/ai-edit`, { instruction: t });
      patch({ result: r });
      if (r.status === 'ok' && r.applied?.length) onChanged();
    } catch (e) {
      patch({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-[26rem] flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Edit with AI</SheetTitle>
          <SheetDescription>Tell the AI what to add, change or remove. It checks every query before applying it.</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="flex flex-col gap-1.5">
              {IDEAS.map((i) => <button key={i} type="button" onClick={() => send(i)} className="rounded-lg border bg-card px-3 py-1.5 text-left text-sm hover:border-primary hover:text-primary">{i}</button>)}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground">{t.instruction}</div>
              {t.error && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{t.error}</p>}
              {t.result?.status !== undefined && t.result.status !== 'ok' && (
                <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                  {t.result.detail}{t.result.status === 'no_provider' && <> <Link to="/settings" className="underline">Open Settings</Link></>}
                </p>
              )}
              {t.result?.status === 'ok' && (
                <div className="rounded-lg border bg-muted/40 p-2.5 text-sm">
                  <p>{t.result.message}</p>
                  {t.result.applied?.map((a) => <p key={a} className="mt-1 flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" />{a}</p>)}
                  {t.result.skipped?.map((s) => <p key={s.title + s.reason} className="mt-1 text-xs text-muted-foreground">Skipped <b>{s.title}</b>: {s.reason}</p>)}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Working on it…</p>}
          <div ref={end} />
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring/40">
            <textarea value={text} rows={2} onChange={(e) => setText(e.target.value)} placeholder="e.g. add a bar chart of profit by country"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
              className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={() => send(text)} disabled={busy || !text.trim()} aria-label="Send"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-4" /></button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
