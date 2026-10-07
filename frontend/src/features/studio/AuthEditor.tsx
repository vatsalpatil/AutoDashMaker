import { SelectField } from '@/components/common/SelectField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthDraft } from './studioModel';

const Field = ({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div className="flex flex-col gap-1.5"><Label className="font-normal text-muted-foreground">{label}</Label><Input className="h-8" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>
);

/** Authorization tab: none, bearer token, basic, or an API key header. Values may use {{variables}}. */
export function AuthEditor({ auth, onChange }: { auth: AuthDraft; onChange: (a: AuthDraft) => void }) {
  const set = (patch: Partial<AuthDraft>) => onChange({ ...auth, ...patch });
  return (
    <div className="flex max-w-md flex-col gap-3 p-3">
      <SelectField label="Type" value={auth.type} onChange={(e) => set({ type: e.target.value as AuthDraft['type'] })}>
        <option value="none">No auth</option><option value="bearer">Bearer token</option><option value="basic">Basic auth</option><option value="apikey">API key (header)</option>
      </SelectField>
      {auth.type === 'bearer' && <Field label="Token" value={auth.token} onChange={(v) => set({ token: v })} type="password" placeholder="{{token}}" />}
      {auth.type === 'basic' && <><Field label="Username" value={auth.user} onChange={(v) => set({ user: v })} /><Field label="Password" value={auth.pass} onChange={(v) => set({ pass: v })} type="password" /></>}
      {auth.type === 'apikey' && <><Field label="Header name" value={auth.header} onChange={(v) => set({ header: v })} /><Field label="Key" value={auth.key} onChange={(v) => set({ key: v })} type="password" /></>}
      <p className="text-xs text-muted-foreground">Credentials stay in this browser; they are sent only with the request, and saved with a source only if you choose “Save as source”.</p>
    </div>
  );
}
