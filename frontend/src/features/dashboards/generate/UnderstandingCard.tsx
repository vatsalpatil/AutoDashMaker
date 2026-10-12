import { useEffect, useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { Button, Card, TextArea, TextInput } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { EvidenceTabs } from './EvidenceTabs';
import type { Evidence, Question, Understanding } from './useGenerateSession';

const SEP = ' | ';
const split = (v: string) => v.split(SEP).filter(Boolean);

/** Every question takes any number of the suggested answers plus your own text (all are sent to the planner). */
function QuestionBlock({ q, value, onChange }: { q: Question; value: string; onChange: (v: string) => void }) {
  const parts = split(value);
  const picked = parts.filter((p) => q.options.includes(p));
  const custom = parts.filter((p) => !q.options.includes(p)).join(', ');
  const save = (p: string[], c: string) => onChange([...p, ...(c.trim() ? [c] : [])].join(SEP));
  const flip = (o: string) => save(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o], custom);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{q.question}</p>
        <span className="text-[11px] text-muted-foreground">{picked.length ? `${picked.length} selected` : 'Pick one or more'}</span>
      </div>
      {q.why && <p className="text-xs text-muted-foreground">{q.why}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {q.options.map((o) => {
          const on = picked.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => flip(o)}
              className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}>
              <span className={cn('flex size-3.5 items-center justify-center rounded-sm border', on && 'border-primary bg-primary text-primary-foreground')}>{on && <Check className="size-3" />}</span>
              {o}
            </button>
          );
        })}
        {q.options.length > 1 && (
          <button type="button" className="px-1 text-xs text-primary" onClick={() => save(picked.length === q.options.length ? [] : q.options, custom)}>
            {picked.length === q.options.length ? 'Clear' : 'Select all'}
          </button>
        )}
      </div>
      <div className="mt-2"><TextInput label="" aria-label={`${q.question} (your own answer)`} value={custom} placeholder="Add your own answer (kept together with the ones you picked)" onChange={(c) => save(picked, c)} /></div>
    </div>
  );
}

/** Step 2: what the AI found (with the evidence it used) and the questions it wants you to settle before planning. */
export function UnderstandingCard({ evidence, understanding, busy, onContinue, onAnswers }: {
  evidence: Evidence | null; understanding: Understanding | null; busy: boolean; onContinue: (answers: Record<string, string>) => void;
  onAnswers?: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  useEffect(() => { onAnswers?.({ ...answers, ...(notes.trim() ? { notes: notes.trim() } : {}) }); }, [answers, notes, onAnswers]);
  const final = () => ({ ...answers, ...(notes.trim() ? { notes: notes.trim() } : {}) });
  return (
    <Card padding={4}>
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">What the AI sees in your data</h2>
        {evidence && (
          <details className="group rounded-lg border bg-muted/20 p-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-primary">Evidence the AI used — statistics, top rows, correlations</summary>
            <div className="mt-2"><EvidenceTabs evidence={evidence} /></div>
          </details>
        )}
        {understanding && (<>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-sm">{understanding.understanding}</p>
            {understanding.thinking.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{understanding.thinking.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </div>
          {understanding.ideas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Lightbulb className="size-4 text-warning" />
              {understanding.ideas.map((i) => (
                <button key={i} type="button" onClick={() => setNotes((n) => (n ? `${n}; ` : '') + i)} title="Add this idea to your notes"
                  className="rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary hover:text-primary">{i}</button>
              ))}
            </div>
          )}
          {understanding.questions.length > 0 && <p className="text-sm font-medium">Before it plans, the AI would like your input:</p>}
          {understanding.questions.map((q) => <QuestionBlock key={q.id} q={q} value={answers[q.id] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}
          <TextArea label="Anything else the AI should know? (optional)" value={notes} onChange={setNotes} rows={2} placeholder="Audience, goals, definitions, what to avoid…" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" label="Skip questions" onClick={() => onContinue({})} isDisabled={busy} />
            <Button variant="primary" label={busy ? 'Planning…' : 'Plan the dashboard'} onClick={() => onContinue(final())} isDisabled={busy} />
          </div>
        </>)}
      </div>
    </Card>
  );
}
