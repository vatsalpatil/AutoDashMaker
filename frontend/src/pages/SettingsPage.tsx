import { Suspense } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Loading } from '@/components/common/Loading';
import { Tab, TabList } from '@/components/ui/kit';
import AiSettings from '@/features/ai/AiSettings';
import AiUsagePanel from '@/features/ai/usage/AiUsagePanel';
import { useAuth } from '@/features/auth/AuthProvider';
import AccountSettings from '@/features/settings/AccountSettings';
import ConnectAiSettings from '@/features/settings/connect-ai/ConnectAiSettings';
import ThemeSettings from '@/features/settings/ThemeSettings';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const TABS = [
  { id: 'ai', label: 'AI models', hint: 'Choose and key the AI providers that power Ask, chart and dashboard generation.' },
  { id: 'usage', label: 'AI usage', hint: 'Tokens and requests used per provider, so you can watch cost.' },
  { id: 'connect', label: 'Connect your AI', hint: 'Let external AI tools (e.g. MCP clients) query your data through this app.' },
  { id: 'appearance', label: 'Appearance', hint: 'Theme and colours for the whole app.' },
  { id: 'account', label: 'Account', hint: 'Your profile, contact details and account deletion.' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Settings hub: one focused panel per tab (the last tab you used is remembered). Account exists only when sign-in is on. */
export default function SettingsPage() {
  const { enabled } = useAuth();
  const tabs = TABS.filter((t) => t.id !== 'account' || enabled);
  const [tab, setTab] = useLocalStorage<TabId>('settings.tab', 'ai');
  const active: TabId = tabs.some((t) => t.id === tab) ? tab : 'ai';
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader title="Settings" description="Workspace-wide preferences. Pick a section below." />
      <TabList value={active} onChange={(v) => setTab(v as TabId)} aria-label="Settings sections">
        {tabs.map((t) => <Tab key={t.id} value={t.id} label={t.label} />)}
      </TabList>
      <p className="text-sm text-muted-foreground">{tabs.find((t) => t.id === active)?.hint}</p>
      <Suspense fallback={<Loading />}>
        {active === 'ai' && <AiSettings />}
        {active === 'usage' && <AiUsagePanel />}
        {active === 'connect' && <ConnectAiSettings />}
        {active === 'appearance' && <ThemeSettings />}
        {active === 'account' && <AccountSettings />}
      </Suspense>
    </div>
  );
}
