import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Phase } from './useGenerateSession';

const STAGES: { label: string; phases: Phase[] }[] = [
  { label: 'Setup', phases: ['setup'] },
  { label: 'Understand', phases: ['understanding', 'questions'] },
  { label: 'Plan', phases: ['planning', 'plan'] },
  { label: 'Build', phases: ['building'] },
  { label: 'Review', phases: ['done'] },
];

/** Where you are in the session: Setup · Understand · Plan · Build · Review. */
export function PhaseStepper({ phase }: { phase: Phase }) {
  const current = STAGES.findIndex((s) => s.phases.includes(phase));
  return (
    <ol className="flex items-center gap-2 overflow-x-auto" aria-label="Progress">
      {STAGES.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={cn('flex size-6 items-center justify-center rounded-full border text-xs transition-colors duration-300',
            i < current ? 'border-success/40 bg-success/15 text-success' : i === current ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={cn('text-sm', i === current ? 'font-semibold' : 'text-muted-foreground')}>{s.label}</span>
          {i < STAGES.length - 1 && <span className={cn('h-px w-8 transition-colors duration-500', i < current ? 'bg-success/60' : 'bg-border')} />}
        </li>
      ))}
    </ol>
  );
}
