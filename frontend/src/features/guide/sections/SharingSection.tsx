import { Card } from '@/components/ui/kit';
import { FlowDiagram } from '../FlowDiagram';
import { H2, P, Steps } from '../GuideParts';

/** Sharing a dashboard with a public read-only link. */
export function SharingSection() {
  return (
    <div className="flex flex-col gap-6">
      <H2>Sharing dashboards</H2>
      <P>Send anyone a link to look at a dashboard. They do not need an account, and they can only look, not change.</P>
      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">How to share</h3>
        <Steps items={[
          'Open the dashboard and click Share in the toolbar.',
          'Choose how long the link works: 1 day, 7 days, 30 days or never expires.',
          'Click Create & copy link. The link is copied: paste it in an email or chat.',
          'To stop sharing, open Share again and click the bin next to the link. It stops working at once.',
        ]} />
      </Card>
      <Card padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">What a viewer can reach</h3>
        <FlowDiagram width={980} height={90}
          nodes={[
            { id: 'v', x: 0, y: 20, w: 140, h: 50, label: 'Viewer', sub: 'no login' },
            { id: 'l', x: 200, y: 20, w: 160, h: 50, label: 'Secret link', sub: 'checked: active?' },
            { id: 'd', x: 420, y: 20, w: 170, h: 50, label: 'This dashboard only', tone: 'ai' },
            { id: 'q', x: 650, y: 20, w: 150, h: 50, label: 'Its saved charts', sub: 'read-only' },
            { id: 'x', x: 860, y: 20, w: 120, h: 50, label: 'Nothing else', tone: 'alert' },
          ]}
          edges={[{ from: 'v', to: 'l' }, { from: 'l', to: 'd' }, { from: 'd', to: 'q' }, { from: 'q', to: 'x' }]} />
        <P>Viewers see the current numbers of the charts on that dashboard. They never see your SQL, your tables, other dashboards, your AI keys or your account. The link is a long random code that cannot be guessed, and repeated wrong guesses are blocked.</P>
      </Card>
      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Good habits</h3>
        <Steps items={[
          'Prefer links that expire. Use “never” only for dashboards meant to be public.',
          'Anyone who has the link can forward it. Do not share dashboards with personal or confidential data.',
          'The Share dialog shows how many times each link was opened, so you can spot unexpected use.',
        ]} />
      </Card>
    </div>
  );
}
