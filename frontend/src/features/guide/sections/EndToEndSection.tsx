import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/kit';
import { GROUPS, NAV } from '@/components/layout/nav';
import { H2, P } from '../GuideParts';

const WHY: Record<string, string> = {
  Start: 'Land on Home for your recent work, or just ask a question in plain English.',
  Connect: 'Bring data in, then check it is complete and trustworthy before relying on it.',
  Explore: 'Slice the data with SQL or the no-code builder until you find the answer.',
  'Define & visualize': 'Save trusted numbers once, turn them into charts, and arrange them on dashboards.',
  Monitor: 'Let the platform watch for you: alerts on thresholds, scheduled reports, and an activity log.',
  Help: 'This guide, plus account, AI provider and appearance settings.',
};

/** The sidebar groups, in order, as the end-to-end workflow (reads straight from nav.ts so it never drifts). */
export function EndToEndSection() {
  return (
    <div className="flex flex-col gap-4">
      <H2>End-to-end workflow</H2>
      <P>The sidebar is ordered the way analysis flows: Connect, Explore, Define & visualize, then Monitor.</P>
      {GROUPS.map((g, i) => (
        <Card key={g} padding={4}>
          <p className="text-sm font-semibold">{i + 1}. {g}</p>
          <p className="mt-1 text-sm text-muted-foreground">{WHY[g]}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {NAV.filter((n) => n.group === g).map((n) => (
              <li key={n.to}><Link className="font-medium text-primary hover:underline" to={n.to}>{n.label}</Link> <span className="text-muted-foreground">— {n.hint}</span></li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
