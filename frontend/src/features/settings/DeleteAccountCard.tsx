import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { supabase } from '@/lib/auth';
import type { Verification } from '@/features/verify/useVerification';
import type { VerifySent } from '@/lib/types';

/** Delete my account: a code emailed to the account + the full email typed back, then everything is erased. */
export function DeleteAccountCard({ v }: { v: Verification }) {
  const s = v.status!;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<VerifySent | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');

  const close = () => { setOpen(false); setSent(null); setCode(''); setEmail(''); };
  const [send, { busy: sending, error: sendError }] = useAsyncAction(async () => {
    setSent(await api.post<VerifySent>('/account/delete/start'));
  });
  const [confirm, { busy: deleting, error: deleteError }] = useAsyncAction(async () => {
    await api.post('/account/delete/confirm', { code, email });
    await supabase().auth.signOut().catch(() => undefined);
    window.location.reload();
  });

  return (
    <Card padding={4} className="flex flex-col gap-3 border-destructive/40">
      <div className="flex items-center gap-2">
        <Trash2 className="size-4 text-destructive" />
        <h3 className="font-semibold">Delete account</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Permanently deletes your sign-in and <b>all your data</b>: datasets, charts, dashboards, alerts, saved queries and uploaded files.
        This cannot be undone.
      </p>
      {!open && <Button variant="danger" className="self-start" label="Delete my account…" onClick={() => setOpen(true)} />}
      {open && (
        <div className="flex flex-col gap-3">
          {!sent ? (
            <p className="text-sm text-muted-foreground">We'll email a 6-digit code to <b className="text-foreground">{s.email_masked || 'your email'}</b> to confirm it's you.</p>
          ) : (
            <>
              <TextInput label={`Code sent to ${sent.to}`} value={code} onChange={(x: string) => setCode(x.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" maxLength={6} placeholder="123456" />
              {sent.dev_code && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Email delivery isn't set up on this server, so the code is in its log (dev code: <b className="font-mono text-foreground">{sent.dev_code}</b>).</p>}
              <TextInput label="Type your full email address to confirm" value={email} onChange={setEmail} type="email" autoComplete="off" placeholder="name@example.com" />
            </>
          )}
          <ErrorBanner message={sendError ?? deleteError} />
          <div className="flex flex-wrap gap-2">
            {sent
              ? <Button variant="danger" label={deleting ? 'Deleting…' : 'Permanently delete my account'} onClick={() => confirm()}
                  isDisabled={deleting || code.length !== 6 || email.trim().length < 5} />
              : <Button variant="primary" label={sending ? 'Sending…' : 'Send code'} onClick={() => send()} isDisabled={sending} />}
            <Button label="Cancel" onClick={close} isDisabled={deleting} />
          </div>
        </div>
      )}
    </Card>
  );
}
