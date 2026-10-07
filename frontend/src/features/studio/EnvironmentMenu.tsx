import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { KeyValueEditor } from './KeyValueEditor';
import { kv, type KV } from './studioModel';

/** Environment variables for the studio: use `{{name}}` in a URL, header, body or auth field (Hoppscotch environments). */
export function EnvironmentMenu() {
  const [vars, setVars] = useLocalStorage<KV[]>('studio.env', [kv()]);
  const count = vars.filter((v) => v.on && v.key).length;
  return (
    <Popover>
      <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-accent">
        <Layers className="size-4" /> Environment{count > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{count}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-2">
        <p className="text-sm font-medium">Variables</p>
        <p className="text-xs text-muted-foreground">Reference them as <code className="mono">{'{{base_url}}'}</code> in any request field. Kept in this browser only.</p>
        <KeyValueEditor rows={vars} onChange={setVars} keyPlaceholder="Variable" valuePlaceholder="Value" />
      </PopoverContent>
    </Popover>
  );
}
