import { Card } from '@/components/ui/kit';
import { FlowDiagram } from '../FlowDiagram';
import { H2, P, Steps } from '../GuideParts';

const STORED: { what: string; where: string; protect: string; kept: string }[] = [
  { what: 'Your uploaded files', where: 'Turned into a compressed Parquet copy in your private workspace folder; the original upload is removed', protect: 'Only your workspace can query it', kept: 'Until you delete the dataset or your account' },
  { what: 'Data from databases / APIs', where: 'A copy in your workspace, or read live (linked datasets keep rows at the source)', protect: 'Connection passwords encrypted at rest', kept: 'Until you delete the source' },
  { what: 'Charts, dashboards, queries, metrics', where: 'Metadata database, tagged with your workspace', protect: 'Every read is filtered to your workspace', kept: 'Until you delete them' },
  { what: 'AI provider keys', where: 'Metadata database', protect: 'Encrypted at rest (AES + HMAC); shown only as •••1234', kept: 'Until you remove the provider' },
  { what: 'AI chats', where: 'Workbench chats live in your browser; Ask sessions in your workspace', protect: 'Never shared between users', kept: 'Last 30 chats in the browser; until deleted on the server' },
  { what: 'Activity log', where: 'Audit log (who did what, when)', protect: 'Your workspace only', kept: 'A bounded number of recent entries; older ones are removed' },
  { what: 'Account (email, login)', where: 'Supabase Auth', protect: 'Passwords hashed by Supabase; we never see them', kept: 'Until you delete your account' },
];

/** Where your data lives, how it is protected, how long it is kept, and what you control. */
export function DataPrivacySection() {
  return (
    <div className="flex flex-col gap-6">
      <H2>Your data &amp; privacy</H2>
      <P>Plain answers to “where is my data, who can see it, and how do I get rid of it?”</P>

      <Card padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">Every user is a separate workspace</h3>
        <FlowDiagram width={980} height={150}
          nodes={[
            { id: 'u', x: 0, y: 50, w: 130, h: 50, label: 'You (signed in)' },
            { id: 'a', x: 180, y: 50, w: 160, h: 50, label: 'Login check', sub: 'token verified' },
            { id: 'w', x: 390, y: 50, w: 170, h: 50, label: 'Your workspace', tone: 'ai' },
            { id: 'f', x: 620, y: 0, w: 170, h: 50, label: 'Your data files', sub: 'own folder + DB' },
            { id: 'm', x: 620, y: 100, w: 170, h: 50, label: 'Your saved work', sub: 'filtered by workspace' },
            { id: 'o', x: 840, y: 50, w: 140, h: 50, label: 'Other users', sub: 'never reachable', tone: 'alert' },
          ]}
          edges={[{ from: 'u', to: 'a' }, { from: 'a', to: 'w' }, { from: 'w', to: 'f' }, { from: 'w', to: 'm' }]} />
        <P>Each account gets its own analytics database file, its own upload folder and its own rows in the metadata database. Queries are checked before they run: only reading is allowed, and reading files on the server or other users’ tables is blocked.</P>
      </Card>

      <Card padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">What we store, where, and for how long</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1 pr-3">What</th><th className="pr-3">Where</th><th className="pr-3">Protection</th><th>Kept</th></tr></thead>
            <tbody className="divide-y">
              {STORED.map((r) => <tr key={r.what} className="align-top"><td className="py-1.5 pr-3 font-medium">{r.what}</td><td className="pr-3">{r.where}</td><td className="pr-3">{r.protect}</td><td>{r.kept}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">What goes to the AI provider</h3>
        <P>To answer a question, the AI sees table and column names, a few sample values, and the small query results it asks for (a few rows). Whole datasets are never sent. The request goes to the provider <i>you</i> connected (Gemini, OpenAI, Anthropic, Groq, OpenRouter) under that provider’s own data terms. Some free tiers may use requests to improve their models, so use a paid key for sensitive data.</P>
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Limits that keep the service healthy</h3>
        <Steps items={['Up to 50 MB per uploaded file and 250 MB in total per account.', 'Up to 5 million rows per dataset and 20 datasets per account.',
          'Uploads are refused when the server disk is nearly full, so existing data is never put at risk.']} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">You are in control</h3>
        <Steps items={[
          'Delete a dataset, chart or dashboard at any time; its stored data goes with it.',
          'Export your definitions (sources, queries, charts, dashboards) from Settings → Backup. Secrets are never included in the file.',
          'Turn off any share link instantly from the dashboard’s Share dialog.',
          'Delete your account from Settings: after a code sent to your email, your login, every row and every file of your workspace are removed.',
        ]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Practices we follow</h3>
        <Steps items={[
          'Collect the minimum: no tracking or advertising cookies; the browser keeps only your login, settings and your AI chats.',
          'Least access: every request is tied to one workspace; public links reach exactly one dashboard.',
          'Encrypt secrets at rest and send everything over HTTPS.',
          'Keep logs bounded and free of data values (they record actions, not your rows).',
          'Make deletion real: deleting removes files from disk, not just a flag.',
        ]} />
      </Card>
    </div>
  );
}
