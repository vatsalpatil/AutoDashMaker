import { Card } from '@/components/ui/kit';
import { FlowDiagram } from '../FlowDiagram';
import { H2, Kbd, P, Steps } from '../GuideParts';

/** How the Workbench AI agent works, what it can and cannot do, and how to get the best out of it. */
export function AiAssistantSection() {
  return (
    <div className="flex flex-col gap-6">
      <H2>The AI assistant</H2>
      <P>The assistant in the SQL notebook works like a careful analyst: it looks at your tables, tries a query, reads the result, fixes mistakes, and only then answers. You see every step as it happens.</P>

      <Card padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">One answer, step by step</h3>
        <FlowDiagram width={980} height={150}
          nodes={[
            { id: 'q', x: 0, y: 50, w: 120, h: 50, label: 'Your question' },
            { id: 'ctx', x: 160, y: 50, w: 150, h: 50, label: 'Pick tables', sub: 'most relevant first', tone: 'ai' },
            { id: 'think', x: 350, y: 50, w: 120, h: 50, label: 'Plan a step', tone: 'ai' },
            { id: 'tool', x: 510, y: 0, w: 150, h: 50, label: 'Run a tool', sub: 'look / sample / query' },
            { id: 'obs', x: 510, y: 100, w: 150, h: 50, label: 'Read the result', sub: 'errors get fixed' },
            { id: 'ans', x: 840, y: 50, w: 140, h: 50, label: 'Answer', sub: 'numbers + the SQL' },
          ]}
          edges={[{ from: 'q', to: 'ctx' }, { from: 'ctx', to: 'think' }, { from: 'think', to: 'tool' }, { from: 'tool', to: 'obs' },
            { from: 'obs', to: 'think', label: 'repeat' }, { from: 'think', to: 'ans', label: 'done' }]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Two modes</h3>
        <P><b>Agent</b> can add and edit notebook cells for you (with <b>Auto-apply</b> off you approve each change, and every edit has Undo). <b>Ask</b> only answers and never touches the notebook.</P>
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Built to be reliable</h3>
        <Steps items={[
          'Same question, same answer: the model runs with randomness turned off (temperature 0).',
          'It can only read: every query passes a read-only safety check before it runs. It cannot change or delete your data.',
          'It checks its own work: a query that fails is shown to the model with the database error, and it fixes it.',
          'It finishes on time: after about 2½ minutes it stops exploring and answers with what it has.',
          'It saves tokens: only the tables that match your question are sent in full, old results are shortened, and repeated look-ups are answered from memory.',
          'If your main AI provider fails or hits its limit, the next connected provider takes over automatically.',
        ]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Chat controls</h3>
        <Steps items={[
          <>Type <Kbd>@</Kbd> to pick a table, <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line.</>,
          <><Kbd>Esc</Kbd> stops a running answer; <Kbd>↑</Kbd> in an empty box brings back your last message.</>,
          'Hover a message to Copy it or Edit & resend it; use Regenerate under an answer to try again.',
          'History keeps your earlier chats; New starts a clean one. Paste or drop an image to ask about a screenshot.',
        ]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Example</h3>
        <P><b>You:</b> “Which 5 stores made the most revenue last quarter, and how much?”</P>
        <P><b>Assistant:</b> looks at <i>sales</i> → samples rows to see the date format → runs a grouped query → “Store 12 led with $184,200, followed by…”, with the SQL under the answer and buttons to add it as a cell.</P>
        <P>Tip: name the measure (“by revenue”, “by quantity”) and the period. Vague questions make the assistant ask you first instead of guessing.</P>
      </Card>
    </div>
  );
}
