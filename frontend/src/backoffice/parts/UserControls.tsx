import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, TextArea, TextInput } from '@/components/ui/kit';
import type { AdminUserDetail } from '../types';
import { Field, Section } from './Section';
import { useAdminAction } from './useAdmin';

const str = (v: number | null) => (v == null ? '' : String(v));
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/** Per-user overrides (storage, dataset count, AI on/off, private note) + a direct email. */
export function UserControls({ user, onSaved }: { user: AdminUserDetail; onSaved: () => void }) {
  const act = useAdminAction(onSaved);
  const [quota, setQuota] = useState(str(user.quota_mb));
  const [maxDs, setMaxDs] = useState(str(user.max_datasets));
  const [note, setNote] = useState(user.note ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const sendMail = useAdminAction(() => { setSubject(''); setBody(''); });
  const limits = (patch: Record<string, unknown>) => act.run('put', `/admin/users/${user.id}/limits`, patch);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section title="Controls" description="Overrides for this user only. Empty = platform default."
        actions={<label className="flex items-center gap-2 text-sm">AI allowed
          <Switch checked={!user.ai_blocked} disabled={act.busy} onCheckedChange={(v) => limits({ ai_blocked: !v })} /></label>}>
        {act.error && <ErrorBanner message={act.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Storage limit (MB)"><TextInput type="number" min={1} value={quota} onChange={setQuota} placeholder="default" /></Field>
          <Field label="Max datasets"><TextInput type="number" min={1} value={maxDs} onChange={setMaxDs} placeholder="default" /></Field>
        </div>
        <div className="mt-3"><Field label="Private note (only admins see it)"><TextArea value={note} onChange={setNote} rows={2} /></Field></div>
        <Button size="sm" className="mt-3" label="Save" isDisabled={act.busy}
          onClick={() => limits({ quota_mb: numOrNull(quota), max_datasets: numOrNull(maxDs), note })} />
      </Section>
      <Section title="Email this user" description={`Sent from the platform address to ${user.email}.`}>
        {sendMail.error && <ErrorBanner message={sendMail.error} />}
        <div className="flex flex-col gap-2">
          <TextInput value={subject} onChange={setSubject} placeholder="Subject" />
          <TextArea value={body} onChange={setBody} rows={4} placeholder="Message" />
          <Button size="sm" className="self-start" icon={<Mail className="size-4" />} label="Send" isDisabled={sendMail.busy || !subject || !body}
            onClick={() => sendMail.run('post', `/admin/users/${user.id}/email`, { subject, body }, `Send this email to ${user.email}?`)} />
        </div>
      </Section>
    </div>
  );
}
