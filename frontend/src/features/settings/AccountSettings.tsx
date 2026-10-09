import { Loading } from '@/components/common/Loading';
import { useVerification } from '@/features/verify/useVerification';
import { ChangeContactCard } from './ChangeContactCard';

/** Settings → Account: the verified email and mobile number, and how to change them. */
export default function AccountSettings() {
  const v = useVerification();
  if (!v.status) return <Loading />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Changing either one needs a code sent to the new value <b>and</b> a code sent to your other verified contact, so nobody can take over your account from an open session.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <ChangeContactCard channel="email" v={v} />
        <ChangeContactCard channel="phone" v={v} />
      </div>
    </div>
  );
}
