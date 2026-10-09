import { useState } from 'react';
import { Mail, Smartphone } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { supabase } from '@/lib/auth';
import type { Channel, Verification } from '@/features/verify/useVerification';
import type { ContactChangeStarted } from '@/lib/types';

const digits = (x: string) => x.replace(/\D/g, '').slice(0, 6);

/** Current email / mobile number with a "Change" flow: a code to the new value + a code to the account's other verified contact. */
export function ChangeContactCard({ channel, v }: { channel: Channel; v: Verification }) {
  const s = v.status!;
  const isEmail = channel === 'email';
  const Icon = isEmail ? Mail : Smartphone;
  const current = isEmail ? s.email_masked : s.phone_masked;
  const phoneOn = s.channels.phone;
  const proofLabel = isEmail ? (phoneOn ? 'mobile number' : 'email') : 'email';
  const canChange = s.email_verified && (!phoneOn || s.phone_verified);
  const [value, setValue] = useState(isEmail ? '' : '+91');
  const [started, setStarted] = useState<ContactChangeStarted | null>(null);
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [proofCode, setProofCode] = useState('');

  const close = () => { setOpen(false); setStarted(null); setNewCode(''); setProofCode(''); };
  const [start, { busy: starting, error: startError }] = useAsyncAction(async () => {
    setStarted(await api.post<ContactChangeStarted>('/verify/change/start', { channel, new_value: value }));
  });
  const [confirm, { busy: confirming, error: confirmError }] = useAsyncAction(async () => {
    await api.post('/verify/change/confirm', { channel, proof_code: proofCode, new_code: newCode });
    if (isEmail) await supabase().auth.refreshSession().catch(() => undefined); // the sign-in token now carries the new address
    close();
    v.reload();
  });

  return (
    <Card padding={4} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-semibold">{isEmail ? 'Email address' : 'Mobile number'}</h3>
        {(isEmail ? s.email_verified : s.phone_verified) && <Badge variant="success" label="Verified" className="ml-auto" />}
      </div>
      <p className="text-sm text-muted-foreground">{current || 'Not set'}</p>
      {!open && (canChange
        ? <Button className="self-start" label={isEmail ? 'Change email' : 'Change number'} onClick={() => setOpen(true)} />
        : <p className="text-xs text-muted-foreground">Verify your account first to be able to change this.</p>)}
      {open && (
        <div className="flex flex-col gap-3">
          <TextInput label={isEmail ? 'New email address' : 'New mobile number with country code'} value={value} onChange={setValue}
            type={isEmail ? 'email' : 'text'} inputMode={isEmail ? 'email' : 'tel'} isDisabled={!!started} placeholder={isEmail ? 'name@example.com' : '+919876543210'} />
          {started && (
            <>
              <TextInput label={`Code sent to ${started.new.to}`} value={newCode} onChange={(x: string) => setNewCode(digits(x))} inputMode="numeric" maxLength={6} placeholder="123456" />
              <TextInput label={`Code sent to your current ${proofLabel} ${started.proof.to}`} value={proofCode} onChange={(x: string) => setProofCode(digits(x))} inputMode="numeric" maxLength={6} placeholder="123456" />
              {(started.new.dev_code || started.proof.dev_code) && (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Delivery isn't set up on this server, so the codes are in its log (dev codes: <b className="font-mono text-foreground">{started.new.dev_code}</b>, <b className="font-mono text-foreground">{started.proof.dev_code}</b>).</p>
              )}
            </>
          )}
          <ErrorBanner message={startError ?? confirmError} />
          <div className="flex flex-wrap gap-2">
            {started
              ? <Button variant="primary" label={confirming ? 'Checking…' : 'Confirm change'} onClick={() => confirm()} isDisabled={confirming || newCode.length !== 6 || proofCode.length !== 6} />
              : <Button variant="primary" label={starting ? 'Sending…' : 'Send codes'} onClick={() => start()} isDisabled={starting || value.trim().length < 5} />}
            <Button label="Cancel" onClick={close} />
          </div>
        </div>
      )}
    </Card>
  );
}
