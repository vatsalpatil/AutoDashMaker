import { useState, type FormEvent } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { supabase } from '@/lib/auth';

type Mode = 'signin' | 'signup' | 'reset' | 'reset-code' | 'check-email';
const TITLES: Record<Mode, string> = {
  signin: 'Sign in', signup: 'Create account', reset: 'Reset password', 'reset-code': 'Choose a new password', 'check-email': 'Check your email',
};
const confirmLink = () => `${window.location.origin}/?confirmed=1`; // the emailed link comes back here, then the app shows Sign in

/**
 * New user:      Create account -> "Check your email" -> click the link -> Sign in -> Home.
 * Existing user: Sign in -> Home.
 * Nobody is signed in by sign-up itself: the email must be confirmed first.
 */
export function LoginPage({ notice = null }: { notice?: string | null }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState(notice ?? '');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const go = (m: Mode, message = '') => { setMode(m); setInfo(message); setUnconfirmed(false); };

  const [run, { busy, error }] = useAsyncAction(async () => {
    setInfo('');
    const auth = supabase().auth;
    if (mode === 'signin') {
      try {
        // through our backend, which counts wrong passwords (20 in 10 minutes blocks sign-in for 10 minutes)
        const t = await api.post<{ access_token: string; refresh_token: string }>('/auth/login', { email, password });
        const { error } = await auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token });
        if (error) throw new Error(error.message);
      } catch (e) {
        setUnconfirmed(/confirm/i.test((e as Error).message));
        throw e;
      }
    } else if (mode === 'signup') {
      const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: confirmLink() } });
      if (error) throw new Error(error.message);
      if (!data.session) setMode('check-email'); // no session = the email still has to be confirmed
    } else if (mode === 'reset') {
      await api.post('/auth/password/forgot', { email }); // always answers the same, whether or not the address has an account
      setMode('reset-code');
      setInfo('If that email has an account, we sent a 6-digit code. It expires in 10 minutes.');
    } else {
      await api.post('/auth/password/reset', { email, code, password: newPassword });
      go('signin', 'Password changed. Please sign in with your new password.');
      setPassword(''); setCode(''); setNewPassword('');
    }
  });
  const [resendCode, { busy: resendingCode, error: resendCodeError }] = useAsyncAction(async () => {
    await api.post('/auth/password/forgot', { email });
    setInfo('Sent again. It can take a minute; check your spam folder too.');
  });
  const [resend, { busy: resending, error: resendError }] = useAsyncAction(async () => {
    const { error } = await supabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmLink() } });
    if (error) throw new Error(error.message);
    setInfo('Sent again. It can take a minute; check your spam folder too.');
  });
  const google = () => void supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void run(); };

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <LogoIcon className="size-11 shrink-0" />
          <span className="text-2xl font-semibold leading-none tracking-tight">{BRAND_NAME}</span>
        </div>
        <h1 className="text-lg font-semibold">{TITLES[mode]}</h1>
        {mode === 'check-email' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <b className="text-foreground">{email}</b>. Open it, then come back and sign in.
              If you already have an account with this email, just sign in.
            </p>
            <ErrorBanner message={resendError} />
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
            <Button className="w-full" label={resending ? 'Sending…' : 'Resend the email'} onClick={() => resend()} isDisabled={resending} />
            <Button variant="primary" className="w-full" label="Go to sign in" onClick={() => go('signin')} />
          </div>
        ) : mode === 'reset-code' ? (
          <form onSubmit={onSubmit} className="space-y-3">
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
            <TextInput label="6-digit code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
              value={code} onChange={(x: string) => setCode(x.replace(/\D/g, '').slice(0, 6))} />
            <TextInput label="New password" type="password" required minLength={8} maxLength={72} placeholder="8+ characters" autoComplete="new-password"
              value={newPassword} onChange={setNewPassword} />
            <ErrorBanner message={error ?? resendCodeError} />
            <Button type="submit" variant="primary" className="w-full" isDisabled={busy || code.length !== 6 || newPassword.length < 8}>{busy ? 'Please wait…' : 'Change password'}</Button>
            <Button className="w-full" label={resendingCode ? 'Sending…' : 'Send a new code'} onClick={() => resendCode()} isDisabled={resendingCode} />
            <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => go('signin')}>Back to sign in</button>
          </form>
        ) : (
          <>
            <form onSubmit={onSubmit} className="space-y-3">
              <TextInput type="email" required placeholder="Email" autoComplete="email" value={email} onChange={setEmail} />
              {mode !== 'reset' && (
                <TextInput type="password" required minLength={8} placeholder="Password (8+ characters)" value={password}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onChange={setPassword} />
              )}
              <ErrorBanner message={error} />
              {unconfirmed && (
                <Button className="w-full" label={resending ? 'Sending…' : 'Resend the confirmation email'} onClick={() => resend()} isDisabled={resending || !email} />
              )}
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              <Button type="submit" className="w-full" isDisabled={busy}>{busy ? 'Please wait…' : TITLES[mode]}</Button>
            </form>
            {mode !== 'reset' && <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>}
            <div className="flex justify-between text-sm text-muted-foreground">
              <button className="hover:underline" onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
              </button>
              {mode === 'signin' && <button className="hover:underline" onClick={() => go('reset')}>Forgot password?</button>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
