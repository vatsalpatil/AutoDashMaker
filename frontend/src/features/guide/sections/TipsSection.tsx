import { AlertTriangle, Check, Database, Keyboard, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/kit';
import { Code, H2, Kbd } from '../GuideParts';

export function TipsSection() {
  return (
  <div className="flex flex-col gap-4">
    <H2>Keyboard & tips</H2>
    <Card padding={4}>
      <ul className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
        <li className="flex items-start gap-3">
          <Keyboard className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>
            Press <Kbd>Enter</Kbd> to submit in the <strong>Ask</strong> page input and the Workbench AI
            assistant. Use <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a newline.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Database className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>
            In SQL transform layers, reference the previous layer’s output as <Code>{'{df}'}</Code> — e.g.{' '}
            <Code>SELECT * FROM {'{df}'} WHERE amount &gt; 0</Code>.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>
            In Python transform layers, the previous layer is available as the <Code>result</Code> variable (a
            DataFrame). Assign your output back to <Code>result</Code>.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="mt-1 h-4 w-4 shrink-0 text-success" />
          <span>
            Mark strong AI answers with the <Check className="inline h-3.5 w-3.5" /> feedback button and save
            them to the verified library — future answers get better.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <X className="mt-1 h-4 w-4 shrink-0 text-destructive" />
          <span>
            Use the <X className="inline h-3.5 w-3.5" /> feedback button on wrong answers too — corrections are
            signal, not noise.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
          <span>
            A dataset with a freshness badge isn’t broken — click <strong>why?</strong> to see exactly what the
            check expected and what it found.
          </span>
        </li>
      </ul>
    </Card>
  </div>
  );
}
