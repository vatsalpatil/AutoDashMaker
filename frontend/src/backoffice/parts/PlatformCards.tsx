import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button, TextInput } from '@/components/ui/kit';
import { SelectField } from '@/components/common/SelectField';
import { Field, Section } from './Section';
import { useSettings } from './AiSwitch';

/** Site-wide banner every user sees at the top of the app. */
export function AnnouncementCard() {
  const { conf, save, busy } = useSettings();
  const cur = conf?.announcement;
  const [text, setText] = useState('');
  const [level, setLevel] = useState('info');
  useEffect(() => { if (cur) { setText(cur.text ?? ''); setLevel(cur.level ?? 'info'); } }, [cur?.text, cur?.level]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null;
  return (
    <Section title="Announcement banner" description="Shown at the top of the app for every signed-in user."
      actions={<Switch checked={!!cur.on} disabled={busy || !text} onCheckedChange={(v) => save('announcement', { on: v, text, level })} />}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1"><Field label="Text"><TextInput value={text} onChange={setText} placeholder="e.g. New: AI dashboards are 2× faster" /></Field></div>
        <Field label="Style">
          <SelectField value={level} onChange={(e) => setLevel(e.target.value)} className="w-32">
            <option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option>
          </SelectField>
        </Field>
        <Button size="sm" label="Save" isDisabled={busy} onClick={() => save('announcement', { text, level })} />
      </div>
    </Section>
  );
}

const LIMITS = [
  { key: 'user_quota_mb', label: 'Storage per user (MB)' }, { key: 'max_datasets', label: 'Datasets per user' },
  { key: 'max_rows_per_dataset', label: 'Rows per dataset' }, { key: 'max_upload_mb', label: 'Max upload (MB)' },
];

/** Platform-wide default limits (users can still get their own override on their page). Empty = the server's .env value. */
export function LimitsCard() {
  const { conf, defaults, save, busy } = useSettings();
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    if (conf) setVals(Object.fromEntries(LIMITS.map(({ key }) => [key, conf.limits[key] != null ? String(conf.limits[key]) : ''])));
  }, [conf]);
  if (!conf || !defaults) return null;
  return (
    <Section title="Default limits" description="Applies to every user without a personal override. Leave empty to use the server default.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LIMITS.map(({ key, label }) => (
          <Field key={key} label={label} hint={`server default: ${defaults[key]?.toLocaleString()}`}>
            <TextInput type="number" min={1} value={vals[key] ?? ''} onChange={(v) => setVals({ ...vals, [key]: v })} placeholder={String(defaults[key])} />
          </Field>
        ))}
      </div>
      <Button size="sm" className="mt-3" label="Save limits" isDisabled={busy} onClick={() => save('limits', vals)} />
    </Section>
  );
}
