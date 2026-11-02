import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SelectField } from '@/components/common/SelectField';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { CLIENTS, fill } from './clients';
import { Snippet } from './Snippet';

interface Token { id: string; name: string; prefix: string; scope: 'full' | 'read'; last_used_at: string | null; created_at: string }

const BASE = `${window.location.origin}/api/mcp`;
const when = (v: string | null) => (v ? new Date(v).toLocaleString() : 'never');

/** Bring your own AI: make an access token, then plug Dashtor into Claude, ChatGPT, Cursor... over MCP.
 *  The user's AI does the thinking on their own subscription, so it costs us no AI credits. */
export default function ConnectAiSettings() {
  const { data: tokens, error, reload } = useApi<Token[]>('/access-tokens');
  const [name, setName] = useState('My AI');
  const [scope, setScope] = useState<'full' | 'read'>('full');
  const [fresh, setFresh] = useState<string | null>(null);   // shown once, right after creation
  const [client, setClient] = useState(CLIENTS[0].id);
  const [create, creating] = useAsyncAction(async () => {
    const t = await api.post<Token & { token: string }>('/access-tokens', { name, scope });
    setFresh(t.token);
    reload();
  });
  const [revoke, revoking] = useAsyncAction(async (id: string) => { await api.del(`/access-tokens/${id}`); reload(); });

  const token = fresh ?? '<your token>';
  const vars = { url: `${BASE}/t/${token}`, base: BASE, token };
  const c = CLIENTS.find((x) => x.id === client) ?? CLIENTS[0];

  return (
    <div className="flex flex-col gap-5">
      <Card padding={4}>
        <h2 className="mb-1 font-semibold">Connect your own AI</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Let Claude, ChatGPT, Cursor, Kimi, DeepSeek, Grok or any MCP-capable assistant run Dashtor for you: connect data, explore
          with SQL, build dashboards and share them. It runs on your AI subscription, so it uses none of your Dashtor AI credits.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <TextInput label="Token name" value={name} onChange={setName} className="w-56" />
          <SelectField label="Access" value={scope} onChange={(e) => setScope(e.target.value as 'full' | 'read')} className="w-56">
            <option value="full">Full (build and change)</option>
            <option value="read">Read only (explore and query)</option>
          </SelectField>
          <Button variant="primary" icon={<Plus className="size-4" />} label={creating.busy ? 'Creating…' : 'Create token'}
            onClick={() => create()} isDisabled={creating.busy || !name.trim()} />
        </div>
        <ErrorBanner message={creating.error} />
        {fresh && (
          <div className="mt-4 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/5 p-3">
            <p className="text-sm font-medium">Copy your token now. It is shown only once.</p>
            <Snippet text={fresh} />
          </div>
        )}
      </Card>

      <Card padding={4}>
        <h2 className="mb-3 font-semibold">Set up your AI app</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {CLIENTS.map((x) => (
            <Button key={x.id} size="sm" variant={x.id === client ? 'primary' : 'outline'} label={x.name} onClick={() => setClient(x.id)} />
          ))}
        </div>
        <ol className="mb-3 list-inside list-decimal space-y-1 text-sm">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {c.snippet && <Snippet text={fill(c.snippet, vars)} />}
        {!fresh && <p className="mt-2 text-xs text-muted-foreground">Create a token above to fill it in automatically.</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Anyone with the token can act as you. Keep it private and revoke it below if it leaks.
        </p>
      </Card>

      <Card padding={4}>
        <h2 className="mb-3 font-semibold">Your tokens</h2>
        <ErrorBanner message={error ?? revoking.error} />
        {!tokens?.length ? <p className="text-sm text-muted-foreground">No tokens yet.</p> : (
          <ul className="divide-y">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <KeyRound className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.name} <Badge label={t.scope === 'read' ? 'read only' : 'full'} /></div>
                  <div className="text-xs text-muted-foreground">{t.prefix}… · last used {when(t.last_used_at)}</div>
                </div>
                <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} label="Revoke"
                  onClick={() => revoke(t.id)} isDisabled={revoking.busy} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
