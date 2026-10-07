import { Loading } from '@/components/common/Loading';
import { Card } from '@/components/ui/kit';
import type { BriefResponse } from '@/lib/types';
import type { LineageNode } from './useDashboardPage';

/** "Decision brief": findings and what needs attention, from live re-execution of the widgets. */
export function BriefCard({ brief }: { brief: BriefResponse | null }) {
  return (
    <Card padding={4}>
      <h3 className="mb-2 font-semibold">Decision brief</h3>
      {!brief ? <Loading /> : (
        <div className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">{brief.findings.map((f, i) => <li key={i}>{f}</li>)}</ol>
          {brief.attention.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <div className="mb-1 text-sm font-semibold text-destructive">Needs attention</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{brief.attention.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {brief.generated_from && <p className="text-xs text-muted-foreground/70">Generated from {brief.generated_from}</p>}
        </div>
      )}
    </Card>
  );
}

/** Source → Dataset → Query → Chart lineage of the dashboard, as JSON. */
export function LineageCard({ lineage }: { lineage: LineageNode | null }) {
  return (
    <Card padding={4}>
      <h3 className="mb-2 font-semibold">Lineage (Source → Dataset → Query → Chart)</h3>
      {lineage
        ? <pre className="mono max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(lineage, null, 2)}</pre>
        : <Loading />}
    </Card>
  );
}
