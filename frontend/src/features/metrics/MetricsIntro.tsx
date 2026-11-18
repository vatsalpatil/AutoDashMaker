import { X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const POINTS = [
  { title: 'What it is', text: 'One agreed calculation, e.g. revenue = SUM(amount) on orders, with a name and a plain-English meaning.' },
  { title: 'Where it is used', text: 'Pinned numbers are what Ask uses when you say their name, so everyone gets the same answer.' },
  { title: 'How to start', text: 'Pin a suggestion below, or build a custom number from any dataset with optional filters.' },
];

/** Dismissible three-point explainer of what a key number (metric) is and where it is used. */
export function MetricsIntro() {
  const [hidden, setHidden] = useLocalStorage<boolean>('metrics.introHidden', false);
  if (hidden) return null;
  return (
    <div className="relative grid gap-3 rounded-lg border bg-muted/30 p-3 pr-9 sm:grid-cols-3">
      {POINTS.map((p) => (
        <div key={p.title} className="text-xs">
          <div className="font-semibold text-foreground">{p.title}</div>
          <p className="mt-0.5 text-muted-foreground">{p.text}</p>
        </div>
      ))}
      <button type="button" aria-label="Hide explanation" onClick={() => setHidden(true)}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>
    </div>
  );
}
