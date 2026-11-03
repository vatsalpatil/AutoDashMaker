import { Bot, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { Button, Card } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';

const CAN = {
  full: ['Read your datasets and run read-only SQL', 'Connect sources and import data', 'Create and edit charts and dashboards', 'Create share links'],
  read: ['Read your datasets and run read-only SQL', 'See your charts and dashboards', 'No changes to anything'],
};

/** /oauth/consent: an AI app (Claude, ChatGPT...) asks to connect to this workspace over MCP. Reached from /api/oauth/authorize. */
export default function ConsentPage() {
  const { search } = useLocation();
  const params = Object.fromEntries(new URLSearchParams(search));
  const q = new URLSearchParams({ client_id: params.client_id ?? '', redirect_uri: params.redirect_uri ?? '' });
  const { data: client, error, loading } = useApi<{ name: string; redirect_host: string }>(`/oauth/client?${q}`);
  const [scope, setScope] = useState<'full' | 'read'>(params.scope === 'read' ? 'read' : 'full');
  const [answer, answering] = useAsyncAction(async (allow: boolean) => {
    const r = await api.post<{ redirect: string }>('/oauth/approve', { params, allow, scope });
    window.location.href = r.redirect;
  });

  if (loading) return <Loading />;
  return (
    <div className="mx-auto mt-10 w-full max-w-md">
      <Card padding={6} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="size-6" /></div>
          <div>
            <h1 className="text-lg font-semibold">{client ? `${client.name} wants to connect` : 'Connect an AI app'}</h1>
            {client?.redirect_host && <p className="text-xs text-muted-foreground">Returns to {client.redirect_host}</p>}
          </div>
        </div>
        <ErrorBanner message={error ? 'This connection request is invalid or expired. Start again from your AI app.' : answering.error} />
        {client && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(['full', 'read'] as const).map((s) => (
                <Button key={s} size="sm" variant={scope === s ? 'primary' : 'outline'} label={s === 'full' ? 'Full access' : 'Read only'} onClick={() => setScope(s)} />
              ))}
            </div>
            <ul className="space-y-1.5 text-sm">
              {CAN[scope].map((c) => <li key={c} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />{c}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">
              It acts as you in this workspace only. Revoke it any time in Settings → Connect your AI.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" label="Cancel" onClick={() => answer(false)} isDisabled={answering.busy} />
              <Button variant="primary" label={answering.busy ? 'Connecting…' : 'Allow'} onClick={() => answer(true)} isDisabled={answering.busy} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
