import { useEffect, useRef } from 'react';
import { Eraser, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { AskEmptyState } from '@/features/ask/AskEmptyState';
import { AnswerCard } from '@/features/ask/AnswerCard';
import { Composer } from '@/features/ask/Composer';
import { useAskThread, type AskTurn } from '@/features/ask/useAskThread';
import { SessionHistory } from '@/features/ai/history/SessionHistory';
import { useAiSessions } from '@/features/ai/history/useAiSessions';
import { MessageImages } from '@/features/ai/attachments/Attachments';
import { useApi } from '@/hooks/useApi';
import { ASK_EVENT, takePendingQuestion } from '@/lib/askHandoff';
import type { Dataset } from '@/lib/types';

/** Ask: a conversation with an analyst that can see every table, saved query and metric. */
export default function AskPage() {
  const { turns, ask, scope, setScope, restore, clear, busy } = useAskThread();
  const history = useAiSessions<{ turns: AskTurn[]; scope: string }>('ask');
  // autosave each finished answer; result rows are trimmed so a saved chat stays light
  useEffect(() => {
    if (busy || !turns.length) return;
    const slim = turns.map((t) => ({ ...t, response: t.response && 'rows' in t.response && Array.isArray(t.response.rows) ? { ...t.response, rows: t.response.rows.slice(0, 200) } : t.response }));
    history.autosave({ turns: slim as AskTurn[], scope }, turns[0].question.slice(0, 80), `${turns.length} question${turns.length > 1 ? 's' : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, busy]);
  const newChat = () => { history.startNew(); clear(); };
  const openSaved = async (id: string) => { const v = await history.open(id); if (v) restore(v); };
  const historyButton = <SessionHistory h={history} busy={busy} onOpen={openSaved} onNew={newChat} />;
  const datasets = useApi<Dataset[]>('/datasets').data ?? [];
  const starters = useApi<{ questions: string[] }>(datasets.length === 0 ? null : `/ai/suggestions${scope ? `?dataset_id=${scope}` : ''}`).data?.questions ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  // a question typed on Home: run it now (page already open) or on first mount
  useEffect(() => {
    const run = () => { const q = takePendingQuestion(); if (q) void ask(q); };
    run();
    window.addEventListener(ASK_EVENT, run);
    return () => window.removeEventListener(ASK_EVENT, run);
  }, [ask]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns]);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {turns.length === 0 ? (
            <AskEmptyState hasData={datasets.length > 0} starters={starters} onAsk={ask} history={historyButton} />
          ) : (
            <>
              <div className="flex items-center justify-end gap-2">{historyButton}<Button variant="ghost" size="sm" icon={<Eraser className="size-4" />} label="New conversation" onClick={newChat} /></div>
              {turns.map((t) => (
                <div key={t.id} className="flex flex-col gap-3">
                  <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5"><MessageImages images={t.images} /><div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{t.question}</div></div>
                  {t.response ? <AnswerCard question={t.question} response={t.response} onFollowUp={ask} />
                    : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Writing SQL, running it and summarising…</div>}
                </div>
              ))}
            </>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <div className="border-t bg-background/80 px-4 py-3 backdrop-blur">
        <Composer datasets={datasets} scope={scope} onScope={setScope} busy={busy} followUp={turns.length > 0} onSend={ask} />
      </div>
    </div>
  );
}
