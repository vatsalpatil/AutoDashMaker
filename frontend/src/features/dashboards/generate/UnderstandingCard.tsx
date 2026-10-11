import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button, Card, TextArea, TextInput } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { EvidenceTabs } from './EvidenceTabs';
import type { Evidence, Question, Understanding } from './useGenerateSession';

const toggle = (current: string, option: string, multi: boolean) => {
  if (!multi) return current === option ? '' : option;
  const set = new Set(current.split(' | ').filter(Boolean));
  if (set.has(option)) set.delete(option); else set.add(option);
  return [...set].join(' | ');
};

function QuestionBlock({ q, value, onChange }: { q: Question; value: string; onChange: (v: string) => void }) {
  const picked = new Set(value.split(' | '));
  const custom = value && ![...picked].every((v) => q.options.includes(v));
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">{q.question}</p>
      {q.why && <p className="text-xs text-muted-foreground">{q.why}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {q.options.map((o) => (
          <button key={o} type="button" aria-pressed={picked.has(o)} onClick={() => onChange(toggle(value, o, q.multi))}
            className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', picked.has(o) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}>{o}</button>
        ))}
      </div>
      <div className="mt-2"><TextInput label="" aria-label={`${q.question} (your own answer)`} value={custom ? value : ''} placeholder="Or type your own answer" onChange={onChange} /></div>
    </div>
  );
}

/** Step 2: what the AI found (with the evidence it used) and the questions it wants you to settle before planning. */
export function UnderstandingCard({ evidence, understanding, busy, onContinue }: {
  evidence: Evidence | null; understanding: Understanding | null; busy: boolean; onContinue: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const final = () => ({ ...answers, ...(notes.trim() ? { notes: notes.trim() } : {}) });
  return (
    <Card padding={4}>
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">What the AI sees in your data</h2>
        {evidence && <EvidenceTabs evidence={evidence} />}
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
