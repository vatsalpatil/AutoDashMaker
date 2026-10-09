import { useState, type ReactNode } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { LogoIcon } from '@/components/common/LogoIcon';
import { Button, Dialog } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/AuthProvider';
import { BRAND_NAME } from '@/lib/brand';
import { ChannelCard } from './ChannelCard';
import { useVerification, type Verification } from './useVerification';

/** The steps the account still needs (email, mobile), as cards. */
function Steps({ v }: { v: Verification }) {
  const s = v.status!;
  return (
    <div className="grid gap-3">
      {s.channels.email && <ChannelCard channel="email" v={v} />}
      {s.channels.phone && <ChannelCard channel="phone" v={v} />}
    </div>
  );
}

/**
 * Wraps the signed-in app. Verified → nothing extra. Not verified yet → a slim banner with a "Verify now" dialog.
 * Verification required and past its grace period → the app is replaced by the verification screen.
 */
export function VerifyGate({ children }: { children: ReactNode }) {
  const v = useVerification();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const s = v.status;
  if (!s || s.complete) return <>{children}</>; // loading, failed or done: never get in the way

  if (s.blocked) {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-4">
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex items-center gap-3">
            <LogoIcon className="size-9" />
            <div><h1 className="text-xl font-bold">Verify your account</h1><p className="text-sm text-muted-foreground">One quick step before you continue to {BRAND_NAME}.</p></div>
          </div>
          <Steps v={v} />
          <Button className="self-start" label="Sign out" icon={<LogOut className="size-4" />} onClick={signOut} />
        </div>
      </div>
    );
  }

  const deadline = s.required ? new Date(s.grace_ends_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-primary/10 px-4 py-2 text-sm" role="status">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          Verify your {s.missing.map((m) => (m === 'email' ? 'email' : 'mobile number')).join(' and ')} to secure your account
          {deadline && <> — required by <b>{deadline}</b></>}.
        </span>
        <Button size="sm" variant="primary" label="Verify now" onClick={() => setOpen(true)} />
      </div>
      {children}
      <Dialog isOpen={open} onOpenChange={setOpen}>
        <div className="flex w-[28rem] max-w-full flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">Verify your account</h2>
          <Steps v={v} />
          <Button className="self-end" label="Close" onClick={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}
