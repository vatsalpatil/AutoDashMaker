import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { initAuth, supabase } from '@/lib/auth';
import { Loading } from '@/components/common/Loading';
import { VerifyGate } from '@/features/verify/VerifyGate';
import { LoginPage } from './LoginPage';

interface AuthState { enabled: boolean; email: string | null; signOut: () => void }
const Ctx = createContext<AuthState>({ enabled: false, email: null, signOut: () => {} });
export const useAuth = () => useContext(Ctx);

/** Shows the login screen until signed in; passes straight through in local (auth-off) mode. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ready: boolean; enabled: boolean; session: Session | null; notice: string | null }>({ ready: false, enabled: false, session: null, notice: null });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    initAuth().then(({ enabled, session, notice }) => {
      setState({ ready: true, enabled, session, notice });
      if (enabled) unsub = supabase().auth.onAuthStateChange((_e, s) => setState((p) => ({ ...p, session: s }))).data.subscription.unsubscribe;
    }).catch(() => setState({ ready: true, enabled: false, session: null, notice: null }));
    return () => unsub?.();
  }, []);

  if (!state.ready) return <Loading />;
  if (state.enabled && !state.session) return <LoginPage notice={state.notice} />;
  return (
    <Ctx.Provider value={{ enabled: state.enabled, email: state.session?.user.email ?? null, signOut: () => void supabase().auth.signOut() }}>
      {state.enabled ? <VerifyGate>{children}</VerifyGate> : children}
    </Ctx.Provider>
  );
}
