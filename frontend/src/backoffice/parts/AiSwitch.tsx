import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { Switch } from '@/components/ui/switch';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, TextInput } from '@/components/ui/kit';
import { Field, Section } from './Section';
import { useAdminAction } from './useAdmin';

type Conf = Record<string, Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface PlatformSettings { settings: Conf; defaults: Record<string, number> }

/** Shared by every control card: the current settings + a save(key, value) that reloads them. */
export function useSettings() {
  const state = useApi<PlatformSettings>('/admin/settings');
  const act = useAdminAction(state.reload);
  const [saved, setSaved] = useState(false);
  const save = async (key: string, value: unknown, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setSaved(false);
    if (await act.run('put', `/admin/settings/${key}`, value)) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };
  return { conf: state.data?.settings, defaults: state.data?.defaults, save, saved, busy: act.busy, error: act.error ?? state.error };
}

/** "Saved" tick shown for a moment after a successful save. */
export const SavedMark = ({ show }: { show: boolean }) => (show
  ? <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status"><Check className="size-3.5" />Saved</span> : null);

/** A switch + message editor for one {on|enabled, message} setting. */
function ToggleCard({ k, flag, title, description, onLabel, confirmOn }: {
  k: string; flag: 'on' | 'enabled'; title: string; description: string; onLabel: string; confirmOn?: string;
}) {
  const { conf, save, saved, busy, error } = useSettings();
  const cur = conf?.[k];
  const [msg, setMsg] = useState('');
  useEffect(() => { if (cur) setMsg(cur.message ?? ''); }, [cur?.message]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null;
  const active = !!cur[flag];
  const alarming = flag === 'on' ? active : !active;
  return (
    <Section title={<span className="flex items-center gap-2">{title}{alarming && <Badge variant="warning" label={onLabel} />}</span>} description={description}
      actions={<Switch checked={active} disabled={busy}
        onCheckedChange={(v) => save(k, { [flag]: v, message: msg }, (flag === 'on' ? v : !v) ? confirmOn : undefined)} />}>
      {error && <ErrorBanner message={error} />}
      <Field label="Message shown to users">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><TextInput aria-label="Message shown to users" value={msg} onChange={setMsg} /></div>
          <Button size="sm" label="Save" isDisabled={busy || !msg.trim() || msg === cur.message} onClick={() => save(k, { message: msg.trim() })} />
          <SavedMark show={saved} />
        </div>
      </Field>
    </Section>
  );
}

export const AiSwitch = () => (
  <ToggleCard k="ai" flag="enabled" title="AI features" onLabel="AI paused" description="Turn off every AI call on the platform at once (keys stay saved)."
    confirmOn="Pause AI for ALL users?" />
);

export const MaintenanceSwitch = () => (
  <ToggleCard k="maintenance" flag="on" title="Maintenance mode" onLabel="Site in maintenance"
    description="Users see the message and every API call is refused; admins keep full access." confirmOn="Put the whole site into maintenance now?" />
);
