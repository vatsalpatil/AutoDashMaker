import { ArrowRight } from 'lucide-react';
import { Button, Card } from '@/components/ui/kit';
import { P } from '../GuideParts';

export function WelcomeSection({ onStart }: { onStart: () => void }) {
  return (
  <div className="flex flex-col gap-4">
    <h1 className="text-2xl font-bold text-foreground">Welcome to AutoDashMaker</h1>
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <P>
          AutoDashMaker is an <strong>AI-native data platform</strong>. It takes you from raw data to answers
          and live dashboards in one place:
        </P>
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          {['Connect data', 'Semantic layer', 'Ask questions', 'Dashboards', 'Monitoring'].map((t, i, arr) => (
            <span key={t} className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium">{t}</span>
              {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70" />}
            </span>
          ))}
        </div>
        <P>
          The idea: your data shouldn’t require a data team to be useful. Connect a source, describe your
          business metrics once in the semantic layer, then simply ask questions in plain language. The AI
          writes and validates the SQL, explains the results, and turns the best answers into charts,
          dashboards, and alerts that keep watch for you.
        </P>
        <P>
          Use the sections on the left to learn the core concepts, see how data flows through the system, and
          get the most out of every feature.
        </P>
        <div>
          <Button variant="primary" label="Start: Getting Started" onClick={onStart} />
        </div>
      </div>
    </Card>
  </div>
  );
}
