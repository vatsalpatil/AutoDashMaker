import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { VerifySent, VerifyStatus } from '@/lib/types';

export type Channel = 'email' | 'phone';

/** Verification status plus send/confirm actions and the per-channel "resend in N s" countdown. */
export function useVerification() {
  const status = useApi<VerifyStatus>('/verify/status');
  const [wait, setWait] = useState<Record<Channel, number>>({ email: 0, phone: 0 });

  useEffect(() => {
    if (wait.email <= 0 && wait.phone <= 0) return;
    const t = setInterval(() => setWait((w) => ({ email: Math.max(0, w.email - 1), phone: Math.max(0, w.phone - 1) })), 1000);
    return () => clearInterval(t);
  }, [wait.email > 0, wait.phone > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (channel: Channel, phone?: string) => {
    const r = await api.post<VerifySent>('/verify/send', { channel, phone });
    setWait((w) => ({ ...w, [channel]: r.resend_in_s }));
    return r;
  }, []);
  const confirm = useCallback(async (channel: Channel, code: string) => {
    await api.post('/verify/confirm', { channel, code });
    status.reload();
  }, [status]);

  return { status: status.data, loading: status.loading, wait, send, confirm, reload: status.reload };
}
export type Verification = ReturnType<typeof useVerification>;
