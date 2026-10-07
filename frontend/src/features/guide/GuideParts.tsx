import { useState, type ReactNode } from 'react';
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from '@/components/reui/stepper';

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-semibold text-foreground">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground ">
      {children}
    </code>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-input bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-foreground shadow-xs ">
      {children}
    </kbd>
  );
}

export function ConceptCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 ">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

/** Walk-through steps on the ReUI Stepper: click a number (or Back / Next) to read that step. */
export function Steps({ items }: { items: ReactNode[] }) {
  const [step, setStep] = useState(1);
  return (
    <Stepper value={step} onValueChange={setStep} className="flex flex-col gap-4">
      <StepperNav>
        {items.map((_, i) => (
          <StepperItem key={i} step={i + 1} completed={i + 1 < step}>
            <StepperTrigger>
              <StepperIndicator className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:bg-success data-[state=completed]:text-white">{i + 1}</StepperIndicator>
            </StepperTrigger>
            {i < items.length - 1 && <StepperSeparator className="group-data-[state=completed]/step:bg-success" />}
          </StepperItem>
        ))}
      </StepperNav>
      <StepperPanel>
        {items.map((it, i) => (
          <StepperContent key={i} value={i + 1} className="min-h-16 text-sm leading-6 text-muted-foreground">{it}</StepperContent>
        ))}
      </StepperPanel>
      <div className="flex justify-between">
        <button type="button" disabled={step === 1} onClick={() => setStep(step - 1)} className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40">Back</button>
        <button type="button" disabled={step === items.length} onClick={() => setStep(step + 1)} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">Next</button>
      </div>
    </Stepper>
  );
}
