import { useEffect, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Card } from '@/components/ui/kit';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import type { AiProvider } from '@/lib/types';

const STEPS = [0, 5, 10, 20, 30, 50];

/** Auto-switch rule, stored on the active provider: once it has less than N % of its daily limit left, use the key with the most left. */
export function AutoSwitchCard({ active, count, onChanged }: { active: AiProvider; count: number; onChanged: () => void }) {
  const [on, setOn] = useState(active.auto_switch !== false);
  const [below, setBelow] = useState(active.switch_below ?? 5);
  useEffect(() => { setOn(active.auto_switch !== false); setBelow(active.switch_below ?? 5); }, [active]);

  function save(next: { auto_switch: boolean; switch_below: number }) {
    setOn(next.auto_switch);
    setBelow(next.switch_below);
    api.patch(`/ai/providers/${active.id}/switch`, next).then(onChanged).catch(() => onChanged());
  }

  return (
    <Card padding={4}>
      <div className="flex flex-wrap items-center gap-3">
        <Shuffle className="size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Auto-switch keys</p>
          <p className="text-xs text-muted-foreground">
            {on
              ? <>When the active key has {below === 0 ? 'nothing' : `less than ${below}%`} of its daily requests/tokens left (or hits a limit), calls go to the connected key with the most left.</>
              : 'Always use the active key first; others are only tried when it fails.'}
            {count < 2 && ' Add another key (same or different provider) to use this.'}
          </p>
        </div>
        {on && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Switch below
            <select value={below} onChange={(e) => save({ auto_switch: on, switch_below: Number(e.target.value) })}
              className="rounded-md border bg-background px-1.5 py-1 text-xs text-foreground">
              {STEPS.map((s) => <option key={s} value={s}>{s}% left</option>)}
            </select>
          </label>
        )}
        <Switch checked={on} onCheckedChange={(v) => save({ auto_switch: v, switch_below: below })} aria-label="Auto-switch keys" />
      </div>
    </Card>
  );
}
