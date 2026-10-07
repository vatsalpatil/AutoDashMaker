import { useState, type FormEvent } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { supabase } from '@/lib/auth';

type Mode = 'signin' | 'signup' | 'reset';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState('');

  const [run, { busy, error }] = useAsyncAction(async () => {
    setInfo('');
    const auth = supabase().auth;
    if (mode === 'signin') {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } else if (mode === 'signup') {
      const { data, error } = await auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      if (!data.session) setInfo('Check your email to confirm your account, then sign in.');
    } else {
      const { error } = await auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw new Error(error.message);
      setInfo('Password reset link sent — check your email.');
    }
  });
  const google = () => void supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void run(); };
  const title = { signin: 'Sign in', signup: 'Create account', reset: 'Reset password' }[mode];

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><LogoIcon className="size-5" /></span>
          <span className="font-semibold">{BRAND_NAME}</span>
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <TextInput type="email" required placeholder="Email" autoComplete="email" value={email} onChange={setEmail} />
          {mode !== 'reset' && (
            <TextInput type="password" required minLength={8} placeholder="Password (8+ characters)" value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onChange={setPassword} />
          )}
          <ErrorBanner message={error} />
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          <Button type="submit" className="w-full" isDisabled={busy}>{busy ? 'Please wait…' : title}</Button>
        </form>
        {mode !== 'reset' && <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>}
        <div className="flex justify-between text-sm text-muted-foreground">
          <button className="hover:underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
          </button>
          {mode === 'signin' && <button className="hover:underline" onClick={() => setMode('reset')}>Forgot password?</button>}
        </div>
      </Card>
    </div>
  );
}
