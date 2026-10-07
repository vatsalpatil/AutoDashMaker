import { MessageSquareText, Share2, Sparkles, Upload } from 'lucide-react';
import { Panel } from './Panel';

const STEPS = [
  { icon: Upload, title: 'Add your data', text: 'Drop a CSV, Excel, Parquet or JSON file, or connect a database, an API or a Google Sheet.' },
  { icon: MessageSquareText, title: 'Ask or build', text: 'Ask in plain English, build a query step by step, or write SQL. Every answer shows its SQL.' },
  { icon: Share2, title: 'Share what you find', text: 'Turn answers into charts and dashboards, set alerts, and send scheduled reports.' },
];

/** Empty-workspace guidance: what the three steps are. */
export function HowItWorks() {
  return (
    <Panel title="How it works">
      <ol className="grid gap-4 p-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <Icon className="size-4 text-primary" />
            </div>
            <div className="text-sm font-semibold">{title}</div>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

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
