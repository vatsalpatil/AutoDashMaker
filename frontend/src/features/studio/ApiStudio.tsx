import { Braces, Globe, Maximize2, Minimize2, Radio, Share2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EnvironmentMenu } from './EnvironmentMenu';
import { GraphqlPanel } from './GraphqlPanel';
import { JsonLab } from './JsonLab';
import { RestPanel } from './RestPanel';
import { SsePanel } from './SsePanel';
import { WebSocketPanel } from './WebSocketPanel';

type Mode = 'rest' | 'graphql' | 'ws' | 'sse' | 'json';
const MODES: { id: Mode; label: string; icon: typeof Globe; hint: string }[] = [
  { id: 'rest', label: 'REST', icon: Globe, hint: 'HTTP requests' },
  { id: 'graphql', label: 'GraphQL', icon: Share2, hint: 'Queries + schema docs' },
  { id: 'ws', label: 'WebSocket', icon: Radio, hint: 'Live streams' },
  { id: 'sse', label: 'SSE', icon: Zap, hint: 'Server-Sent Events' },
  { id: 'json', label: 'JSON', icon: Braces, hint: 'Edit, query, tabulate' },
];

/**
 * API Studio: explore an API, a stream or a JSON document, then turn what you find into a dataset (a snapshot)
 * or a refreshable source. Hoppscotch-style request workspaces + a JSON Editor Online-style JSON lab.
 */
export function ApiStudio() {
  const [mode, setMode] = useLocalStorage<Mode>('studio.mode', 'rest');
  const full = useFullscreen<HTMLDivElement>();
  return (
    <div ref={full.ref} className="flex h-full min-h-0 bg-background">
      <nav aria-label="Studio mode" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
        {MODES.map(({ id, label, icon: Icon, hint }) => (
          <Tooltip key={id}>
            <TooltipTrigger render={
              <button type="button" aria-label={label} aria-pressed={mode === id} onClick={() => setMode(id)}
                className={cn('grid size-10 place-items-center rounded-lg transition-colors', mode === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                <Icon className="size-5" />
              </button>
            } />
            <TooltipContent side="right"><b>{label}</b> · {hint}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
          <h1 className="text-sm font-semibold">API Studio</h1>
          <span className="hidden text-xs text-muted-foreground sm:inline">— explore, then save as a dataset or a refreshable source</span>
          <div className="ml-auto flex items-center gap-2">
            <EnvironmentMenu />
            <Link to="/sources" className="hidden h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-accent sm:flex">Data Sources</Link>
            <button type="button" onClick={full.toggle} aria-label={full.active ? 'Exit full screen' : 'Full screen'} title={full.active ? 'Exit full screen' : 'Full screen'}
              className="grid size-8 place-items-center rounded-lg border hover:bg-accent">{full.active ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {mode === 'rest' && <RestPanel />}
          {mode === 'graphql' && <GraphqlPanel />}
          {mode === 'ws' && <WebSocketPanel />}
          {mode === 'sse' && <SsePanel />}
          {mode === 'json' && <JsonLab />}
        </div>
      </div>
    </div>
  );
}
