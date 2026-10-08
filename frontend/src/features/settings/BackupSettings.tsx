import { Download } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, Card } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { downloadFile } from '@/lib/auth';

const INCLUDED = ['Saved queries', 'Charts', 'Dashboards and their widgets', 'Metrics, dimensions, definitions and synonyms', 'Verified questions', 'Alerts'];
const EXCLUDED = ['The rows inside your datasets', 'Connection passwords and AI API keys'];

/** Back up what you built (definitions, not data or secrets) as one JSON file: for backups, audits and moving between servers. */
export default function BackupSettings() {
  const [exportNow, { busy, error }] = useAsyncAction(() => downloadFile('/api/system/export', 'dashtor-config.json'));
  return (
    <Card padding={4}>
      <h2 className="mb-1 font-semibold">Export workspace configuration</h2>
      <p className="mb-4 text-sm text-muted-foreground">One JSON file with everything you built on top of your data.</p>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Included</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">{INCLUDED.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not included</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{EXCLUDED.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      </div>
      <ErrorBanner message={error} />
      <Button variant="primary" label={busy ? 'Preparing…' : 'Download configuration'} icon={<Download className="size-4" />} onClick={() => exportNow()} isDisabled={busy} />
    </Card>
  );
}
