import { useEffect, useRef } from 'react';
import { Eraser, Loader2, Sparkles } from 'lucide-react';
import { AttentionPanel } from '@/components/AttentionPanel';
import { Button } from '@/components/ui/kit';
import { AnswerCard } from '@/features/ask/AnswerCard';
import { Composer } from '@/features/ask/Composer';
import { useAskThread } from '@/features/ask/useAskThread';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';

/** Ask: a conversation with an analyst that can see every table, saved query and metric. */
export default function AskPage() {
  const { turns, ask, scope, setScope, clear, busy } = useAskThread();
  const datasets = useApi<Dataset[]>('/datasets').data ?? [];
  const starters = useApi<{ questions: string[] }>(`/ai/suggestions${scope ? `?dataset_id=${scope}` : ''}`).data?.questions ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns]);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center gap-6 pt-6 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">What do you want to know?</h1>
                <p className="mt-1 text-sm text-muted-foreground">I can see all your tables, saved queries and metrics. I write the SQL, run it, chart it and explain it.</p>
              </div>
              {starters.length > 0 && (
                <div className="flex max-w-3xl flex-wrap justify-center gap-2">
                  {starters.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-xs transition-colors hover:border-primary hover:text-primary">{q}</button>)}
                </div>
              )}
              <div className="w-full text-left"><AttentionPanel /></div>
            </div>
          ) : (
            <>
              <div className="flex justify-end"><Button variant="ghost" size="sm" icon={<Eraser className="size-4" />} label="New conversation" onClick={clear} /></div>
              {turns.map((t) => (
                <div key={t.id} className="flex flex-col gap-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{t.question}</div>
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
