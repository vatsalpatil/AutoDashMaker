// Supabase client bootstrap. Config comes from the backend (/api/auth/config) at runtime,
// so one built image works for any Supabase project (no VITE_* build-time keys).
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export interface AuthConfig { enabled: boolean; supabase_url: string; supabase_anon_key: string }

let client: SupabaseClient | null = null;

export async function initAuth(): Promise<{ enabled: boolean; session: Session | null; notice: string | null }> {
  const res = await fetch('/api/auth/config');
  const cfg = (await res.json()) as AuthConfig;
  if (!cfg.enabled) return { enabled: false, session: null, notice: null };
  // loaded only when login is on: local single-user mode never downloads the Supabase client
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(cfg.supabase_url, cfg.supabase_anon_key);
  const url = new URL(window.location.href);
  if (url.searchParams.get('confirmed') === '1') {
    // The confirmation link in the email just signed the user in. The flow wants a normal sign-in next, so end that session.
    const failed = /error/.test(window.location.hash);
    await client.auth.getSession(); // lets supabase-js read the tokens from the link before we drop them
    await client.auth.signOut();
    window.history.replaceState({}, '', url.pathname);
    return {
      enabled: true, session: null,
      notice: failed ? 'That confirmation link is invalid or has expired. Sign in and we will send a new one.' : 'Email confirmed. Please sign in.',
    };
  }
  const { data } = await client.auth.getSession();
  return { enabled: true, session: data.session, notice: null };
}

export const supabase = () => {
  if (!client) throw new Error('Auth not initialised');
  return client;
};

/** fetch() that adds the signed-in user's bearer token (no-op in local mode). */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = client ? (await client.auth.getSession()).data.session?.access_token : undefined;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/** Download a protected file (plain <a href> can't send the token). */
export async function downloadFile(url: string, fallbackName = 'download') {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
