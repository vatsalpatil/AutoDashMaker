import { Suspense } from 'react';
import { Loading } from '@/components/common/Loading';
import { Tab, TabList } from '@/components/ui/kit';
import AiSettings from '@/features/ai/AiSettings';
import { useAuth } from '@/features/auth/AuthProvider';
import AccountSettings from '@/features/settings/AccountSettings';
import ThemeSettings from '@/features/settings/ThemeSettings';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const TABS = [
  { id: 'ai', label: 'AI models' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'account', label: 'Account' },
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
      <h1 className="text-2xl font-bold">Settings</h1>
      <TabList value={active} onChange={(v) => setTab(v as TabId)} aria-label="Settings sections">
        {tabs.map((t) => <Tab key={t.id} value={t.id} label={t.label} />)}
      </TabList>
      <Suspense fallback={<Loading />}>
        {active === 'ai' && <AiSettings />}
        {active === 'appearance' && <ThemeSettings />}
        {active === 'account' && <AccountSettings />}
      </Suspense>
    </div>
  );
}
