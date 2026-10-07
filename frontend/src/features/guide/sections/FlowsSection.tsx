import { Card } from '@/components/ui/kit';
import { FlowDiagram } from '../FlowDiagram';
import { H2 } from '../GuideParts';

export function FlowsSection() {
  return (
  <div className="flex flex-col gap-6">
    <H2>Workflow flowcharts</H2>

    <Card padding={4}>
      <h3 className="mb-3 font-semibold text-foreground">Data flow</h3>
      <FlowDiagram
        width={980}
        height={90}
        nodes={[
          { id: 'src', x: 0, y: 20, w: 120, h: 50, label: 'Source', sub: 'file / DB / URL' },
          { id: 'ds', x: 170, y: 20, w: 120, h: 50, label: 'Dataset', sub: 'physical table' },
          { id: 'tr', x: 340, y: 20, w: 150, h: 50, label: 'Transforms', sub: 'SQL / Python' },
          { id: 'dd', x: 540, y: 20, w: 140, h: 50, label: 'Derived dataset' },
          { id: 'ch', x: 730, y: 20, w: 100, h: 50, label: 'Chart' },
          { id: 'db', x: 880, y: 20, w: 100, h: 50, label: 'Dashboard' },
        ]}
        edges={[
          { from: 'src', to: 'ds', label: 'ingest' },
          { from: 'ds', to: 'tr' },
          { from: 'tr', to: 'dd' },
          { from: 'dd', to: 'ch' },
          { from: 'ch', to: 'db' },
        ]}
      />
    </Card>

    <Card padding={4}>
      <h3 className="mb-3 font-semibold text-foreground">AI pipeline</h3>
      <FlowDiagram
        width={980}
        height={90}
        nodes={[
          { id: 'q', x: 0, y: 20, w: 110, h: 50, label: 'Question' },
          { id: 'ctx', x: 150, y: 20, w: 140, h: 50, label: 'Semantic context', sub: 'metrics + schema', tone: 'ai' },
          { id: 'llm', x: 330, y: 20, w: 90, h: 50, label: 'LLM', tone: 'ai' },
          { id: 'sql', x: 460, y: 20, w: 90, h: 50, label: 'SQL' },
          { id: 'val', x: 590, y: 20, w: 100, h: 50, label: 'Validate' },
          { id: 'ex', x: 730, y: 20, w: 100, h: 50, label: 'Execute' },
          { id: 'out', x: 870, y: 20, w: 110, h: 50, label: 'Explain', sub: 'insights + confidence' },
        ]}
        edges={[
          { from: 'q', to: 'ctx' },
          { from: 'ctx', to: 'llm' },
          { from: 'llm', to: 'sql' },
          { from: 'sql', to: 'val' },
          { from: 'val', to: 'ex' },
          { from: 'ex', to: 'out' },
        ]}
      />
    </Card>

    <Card padding={4}>
      <h3 className="mb-3 font-semibold text-foreground">Alert loop</h3>
      <FlowDiagram
        width={760}
        height={90}
        nodes={[
          { id: 'rule', x: 0, y: 20, w: 110, h: 50, label: 'Rule', tone: 'alert' },
          { id: 'sched', x: 160, y: 20, w: 140, h: 50, label: 'Scheduled check' },
          { id: 'trig', x: 350, y: 20, w: 100, h: 50, label: 'Trigger', tone: 'alert' },
          { id: 'notif', x: 500, y: 20, w: 120, h: 50, label: 'Notification' },
          { id: 'ack', x: 660, y: 20, w: 100, h: 50, label: 'Ack' },
        ]}
        edges={[
          { from: 'rule', to: 'sched' },
          { from: 'sched', to: 'trig', label: 'condition met' },
          { from: 'trig', to: 'notif' },
          { from: 'notif', to: 'ack' },
        ]}
      />
    </Card>
  </div>
  );
}
