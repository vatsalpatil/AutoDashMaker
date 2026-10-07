import { Card } from '@/components/ui/kit';
import { WALKTHROUGHS } from '../guideContent';
import { H2, Steps } from '../GuideParts';

export function WalkthroughsSection() {
  return (
  <div className="flex flex-col gap-4">
    <H2>Feature walkthroughs</H2>
    {WALKTHROUGHS.map((w) => (
      <Card key={w.title} padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">{w.title}</h3>
        <Steps items={w.steps.map((s, i) => <span key={i}>{s}</span>)} />
      </Card>
    ))}
  </div>
  );
}
