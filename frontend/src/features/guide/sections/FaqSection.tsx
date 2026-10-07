import { Card } from '@/components/ui/kit';
import { FAQS } from '../guideContent';
import { H2, P } from '../GuideParts';

export function FaqSection() {
  return (
  <div className="flex flex-col gap-4">
    <H2>FAQ</H2>
    <div className="flex flex-col gap-3">
      {FAQS.map((f) => (
        <Card key={f.q} padding={4}>
          <h3 className="mb-1 text-sm font-semibold text-foreground">{f.q}</h3>
          <P>{f.a}</P>
        </Card>
      ))}
    </div>
  </div>
  );
}
