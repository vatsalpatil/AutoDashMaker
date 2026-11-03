import { Card } from '@/components/ui/kit';
import { CLIENTS, fill } from '@/features/settings/connect-ai/clients';
import { Snippet } from '@/features/settings/connect-ai/Snippet';
import { FlowDiagram } from '../FlowDiagram';
import { Code, H2, P, Steps } from '../GuideParts';

const BASE = `${window.location.origin}/api/mcp`;
const VARS = { base: BASE, url: `${BASE}/t/<your token>`, token: '<your token>' };

const ASKS = [
  'Show me my datasets and what is in the sales table.',
  'Import the orders table from my Postgres source.',
  'Build a dashboard of monthly revenue by region with a KPI for total revenue, then give me a share link.',
  'Make the revenue chart full width and turn it into a line chart.',
  'Which customers bought less this quarter than last? Answer with SQL and a table.',
];

/** Bring your own AI over MCP: what it is, setup per app (same data as Settings → Connect your AI), safety, and examples. */
export function ConnectAiSection() {
  return (
    <div className="flex flex-col gap-6">
      <H2>Connect your own AI (MCP)</H2>
      <P>
        Use the AI you already pay for (Claude, ChatGPT, Cursor, Kimi, DeepSeek, Grok, Gemini…) to run Dashtor: connect data,
        explore it with SQL, build and edit dashboards, and share them. Your AI does the thinking on your own subscription, so it uses
        none of your Dashtor AI credits. It talks to Dashtor through MCP (Model Context Protocol), the open standard AI apps use for tools.
      </P>

      <Card padding={4}>
        <h3 className="mb-3 font-semibold text-foreground">How it fits together</h3>
        <FlowDiagram width={980} height={90}
          nodes={[
            { id: 'u', x: 0, y: 20, w: 150, h: 50, label: 'You', sub: 'chat in your AI' },
            { id: 'a', x: 200, y: 20, w: 170, h: 50, label: 'Your AI app', sub: 'Claude, ChatGPT…', tone: 'ai' },
            { id: 'm', x: 420, y: 20, w: 160, h: 50, label: 'Dashtor MCP', sub: '/api/mcp' },
            { id: 'w', x: 630, y: 20, w: 170, h: 50, label: 'Your workspace', sub: 'same rules as you' },
            { id: 'r', x: 850, y: 20, w: 130, h: 50, label: 'Dashboards', tone: 'ai' },
          ]}
          edges={[{ from: 'u', to: 'a' }, { from: 'a', to: 'm' }, { from: 'm', to: 'w' }, { from: 'w', to: 'r' }]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Your connection address</h3>
        <P>Every app uses this address. Apps with sign-in (Claude, ChatGPT) need nothing else.</P>
        <Snippet text={BASE} />
      </Card>

      {CLIENTS.map((c) => (
        <Card key={c.id} padding={4}>
          <h3 className="mb-2 font-semibold text-foreground">{c.name}</h3>
          <Steps items={c.steps.map((s) => fill(s, VARS))} />
          {c.snippet && <div className="mt-3"><Snippet text={fill(c.snippet, VARS)} /></div>}
        </Card>
      ))}

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Tokens (for apps without sign-in)</h3>
        <Steps items={[
          <>Go to <b>Settings → Connect your AI</b>, name the token and choose <b>Full</b> or <b>Read only</b>.</>,
          'Click Create token and copy it straight away. It is shown only once.',
          <>Put it where the app asks: as the header <Code>Authorization: Bearer &lt;token&gt;</Code>, or inside the address <Code>/api/mcp/t/&lt;token&gt;</Code>.</>,
        ]} />
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Things to ask once connected</h3>
        <Steps items={ASKS.map((a) => <i key={a}>“{a}”</i>)} />
        <P>The AI can also reach alerts, reports, data quality, tests and the query builder. If it is unsure how, ask it to “use the Dashtor guide tool first”.</P>
      </Card>

      <Card padding={4}>
        <h3 className="mb-2 font-semibold text-foreground">Safety</h3>
        <Steps items={[
          'The AI acts as you, only in your workspace. It cannot see other users, admin pages or your account settings.',
          'SQL is read-only: it cannot delete or change rows in your data.',
          'Read only access lets it look and query, never change anything.',
          'Each connection is limited to 120 calls a minute, and wrong tokens are locked out after repeated tries.',
          <>See and revoke every connection in <b>Settings → Connect your AI</b>. Revoking stops it at once.</>,
        ]} />
      </Card>
    </div>
  );
}
