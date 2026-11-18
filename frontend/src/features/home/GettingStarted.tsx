import { Sparkles } from 'lucide-react';
import { Panel } from './Panel';

const EXAMPLES = ['What were total sales by month?', 'Who are my top 10 customers?', 'Which products are growing fastest?', 'Compare this quarter with last quarter'];

/** What to ask once data is in (not clickable yet: there is nothing to ask). */
export function ExampleQuestions() {
  return (
    <Panel title="Once your data is in, ask things like">
      <ul className="divide-y">
        {EXAMPLES.map((q) => (
          <li key={q} className="flex items-start gap-2.5 px-4 py-2.5 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{q}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
