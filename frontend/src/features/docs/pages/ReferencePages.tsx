import { BRAND_NAME } from '@/lib/brand';
import { FeaturesReference } from '../FeaturesReference';
import { FaqSection } from '@/features/guide/sections/FaqSection';
import { Accordion, H2, List, P, PageTitle, Steps, Table, Tip } from '../DocsKit';

export function AccountPage() {
  return (
    <>
      <PageTitle eyebrow="Get started" title="Account & settings" lead={`Create your account, set up AI, and find your way around ${BRAND_NAME}'s settings.`} />
      <H2>Create your account</H2>
      <Steps steps={[
        { title: 'Sign up', body: <P>Click <b>Get started</b> on the home page, enter your email and a password, then open the confirmation link we email you.</P> },
        { title: 'Your private workspace', body: <P>Every account gets its own workspace. Your sources, datasets, charts and dashboards are visible only to you, unless you share a dashboard link.</P> },
        { title: 'Add an AI key (optional)', body: <P>AI features (Ask, AI Assistant, chart and dashboard AI) need an AI provider. Open <b>Settings → AI models</b> and paste a key from Gemini (has a free tier), OpenAI, Anthropic, Groq or OpenRouter. Everything else works without one.</P> },
      ]} />
      <Tip title="No AI key? Use your own AI app">Connect Claude, ChatGPT or Cursor through <b>MCP</b> and use the subscription you already have — see “Connect your AI”.</Tip>
      <H2>Settings tabs</H2>
      <Table head={['Tab', 'What you can do']} code={false} rows={[
        ['AI models', 'Add keys per provider, pick a model, add backup keys that switch in automatically when one runs low.'],
        ['AI usage', 'See how many AI requests you made, by feature and model, and how much quota is left.'],
        ['Connect your AI', 'Create access tokens for Claude, ChatGPT, Cursor and other MCP apps.'],
        ['Appearance', 'Light / dark / system mode and colour themes.'],
        ['Account', 'Change email or password, verify your email, delete your account and all data.'],
      ]} />
      <H2>Tips for picking an AI model</H2>
      <List items={['Pin one specific model: “free/random” routers change model per request, so answers vary.', 'Faster, smaller models are fine for simple questions; use a stronger model for complex joins.', 'You only pay your AI provider for what you use — Dashtor adds no AI charge.']} />
    </>
  );
}

export function LimitsPage() {
  return (
    <>
      <PageTitle eyebrow="Reference" title="Limits" lead="What fits in one account, and what to do when you hit a limit." />
      <Table head={['Limit', 'Value', 'If you hit it']} code={false} rows={[
        ['File upload', '50 MB per file', 'Split the file, or connect the database/API directly instead of uploading.'],
        ['Storage', '250 MB per account', 'Delete datasets or old versions you no longer need.'],
        ['Datasets', '20 per account', 'Combine related files, remove test datasets.'],
        ['Rows per dataset', '5,000,000', 'Import a filtered or aggregated table.'],
        ['Query time', '30 seconds', 'Filter earlier and aggregate; avoid SELECT * on wide tables.'],
        ['Rows shown in the browser', '10,000', 'Aggregate with GROUP BY — charts rarely need more.'],
      ]} />
      <P>Repeated identical queries within 15 minutes are answered from a cache, so dashboards open quickly.</P>
    </>
  );
}

export function FeaturesPage() { return <FeaturesReference />; }

export function TroubleshootingPage() {
  return (
    <>
      <PageTitle eyebrow="Reference" title="Troubleshooting & FAQ" lead="Common messages, what they mean and how to fix them." />
      <H2>Common errors</H2>
      <Accordion items={[
        { q: '“Only read-only SELECT statements are allowed”', a: 'You sent something that changes data, or two statements at once. Keep one SELECT. To create new data, use a transform.' },
        { q: '“Table not found” / unknown column', a: 'Use the dataset\'s SQL name (shown on the dataset page) and check spelling — the Workbench autocompletes both.' },
        { q: 'Query timed out', a: 'Filter earlier, aggregate, and avoid SELECT * on wide tables. Queries stop after 30 seconds.' },
        { q: 'Upload refused', a: 'The file is over 50 MB, or your account is at its storage/dataset limit. Delete old datasets or connect the source directly.' },
        { q: 'AI says it is paused or out of quota', a: 'Your AI key hit its provider\'s limit. Add a second key with auto-switch in Settings → AI models, or wait for the provider\'s reset.' },
        { q: 'Can\'t connect to my database', a: 'It must be reachable from the internet, with the right port open, SSL mode set, and a user that can SELECT.' },
        { q: 'A shared link stopped working', a: 'The owner revoked it or deleted the dashboard. Ask them for a new link.' },
      ]} />
      <H2>FAQ</H2>
      <FaqSection />
    </>
  );
}
