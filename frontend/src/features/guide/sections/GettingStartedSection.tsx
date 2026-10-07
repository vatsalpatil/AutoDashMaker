import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/kit';
import { H2, Steps } from '../GuideParts';

export function GettingStartedSection() {
  return (
  <div className="flex flex-col gap-4">
    <H2>Getting Started</H2>
    <Card padding={4}>
      <Steps
        items={[
          <>
            <strong>Add a source</strong> — go to <strong>Sources</strong> and connect a file (CSV/Excel), a
            database, a URL, or a Google Sheet.
          </>,
          <>
            <strong>Ingest a dataset</strong> — pull a table from your source into a dataset. It becomes a
            physical table you can query.
          </>,
          <>
            <strong>Ask a question or write SQL</strong> — use the <strong>Ask</strong> page for plain-language
            questions, or the <strong>Workbench</strong> for SQL and Python.
          </>,
          <>
            <strong>Save a chart</strong> — turn any result into a chart and save it from the result view.
          </>,
          <>
            <strong>Build a dashboard</strong> — open <strong>Dashboards</strong>, create one, and drag your
            saved charts onto it.
          </>,
          <>
            <strong>Set an alert</strong> — on a chart or metric, create an alert rule so you’re notified when
            something changes.
          </>,
        ]}
      />
    </Card>
    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Tip: configure an AI provider first in <strong>Settings</strong> — Gemini’s free tier is a good way to
        start.
      </span>
    </div>
  </div>
  );
}
