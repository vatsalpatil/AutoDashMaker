import { useState } from 'react';
import { CheckCircle2, Mail, Smartphone } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import type { Channel, Verification } from './useVerification';

/** One verification step: (phone only) enter the number, get a code, type it in. */
export function ChannelCard({ channel, v }: { channel: Channel; v: Verification }) {
  const s = v.status!;
  const isEmail = channel === 'email';
  const verified = isEmail ? s.email_verified : s.phone_verified;
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [send, { busy: sending, error: sendError }] = useAsyncAction(async () => {
    const r = await v.send(channel, isEmail ? undefined : phone);
    setSentTo(r.to); setDevCode(r.dev_code ?? null); setCode('');
  });
  const [confirm, { busy: confirming, error: confirmError }] = useAsyncAction(async () => { await v.confirm(channel, code); setSentTo(null); });
  const wait = v.wait[channel];
  const console_ = s.delivery[channel] === 'console';
  const Icon = isEmail ? Mail : Smartphone;

  return (
    <Card padding={4} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-semibold">{isEmail ? 'Email address' : 'Mobile number'}</h3>
        {verified && <Badge variant="success" label="Verified" className="ml-auto" />}
      </div>
      {verified ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />{isEmail ? s.email_masked : s.phone_masked}</p>
      ) : (
        <>
          {isEmail ? <p className="text-sm text-muted-foreground">We'll send a 6-digit code to <b className="text-foreground">{s.email_masked || 'your email'}</b>.</p>
            : <TextInput label="Mobile number with country code" value={phone} onChange={setPhone} placeholder="+919876543210" inputMode="tel" autoComplete="tel" />}
          {sentTo && (
            <TextInput label={`Enter the code sent to ${sentTo}`} value={code} onChange={(x: string) => setCode(x.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
          )}
          <ErrorBanner message={sendError ?? confirmError} />
          {console_ && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{isEmail ? 'Email' : 'Text message'} delivery isn't set up on this server yet, so the code is written to the server log
            {devCode && <> (dev code: <b className="font-mono text-foreground">{devCode}</b>)</>}.</p>}
          <div className="flex flex-wrap gap-2">
            {sentTo && <Button variant="primary" label={confirming ? 'Checking…' : 'Verify'} onClick={() => confirm()} isDisabled={confirming || code.length !== 6} />}
            <Button variant={sentTo ? 'secondary' : 'primary'} label={sending ? 'Sending…' : wait > 0 ? `Resend in ${wait}s` : sentTo ? 'Resend code' : 'Send code'}
              onClick={() => send()} isDisabled={sending || wait > 0 || (!isEmail && phone.replace(/\D/g, '').length < 8)} />
          </div>
        </>
      )}
    </Card>
  );
}
