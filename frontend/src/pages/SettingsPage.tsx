import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/kit';
import { api } from '@/lib/api';
import type { Health } from '@/lib/types';
import AiSettings from '@/features/ai/AiSettings';
import ThemeSettings from '@/features/settings/ThemeSettings';

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    api.get<Health>('/health').then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">AI models</h2>
        <AiSettings />
      </section>

      <ThemeSettings />

      <Card padding={4}>
        <h2 className="mb-1 font-semibold">About</h2>
        <p className="text-sm text-muted-foreground">
          {health ? `${health.app} v${health.version} — backend ${health.status}` : 'Backend unreachable'}
        </p>
      </Card>
    </div>
  );
}
