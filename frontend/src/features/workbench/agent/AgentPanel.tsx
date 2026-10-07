import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Bot, MessageSquare, Plus, Square, Table2, Timer } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AgentMessage } from './AgentMessage';
import { ChatHistory } from './ChatHistory';
import { ModelPicker } from './ModelPicker';
import { useAgent, type AgentContext, type NotebookActions } from './useAgent';

/** Last `@word` being typed in the composer, if any. */
const mentionAt = (text: string) => /(?:^|\s)@([\w.-]*)$/.exec(text);

/**
 * Workbench assistant in the style of Roo Code / Cline: it plans, looks at your tables, runs read-only queries, and (in Agent mode)
 * writes cells into the notebook, showing every step. Ask mode only answers. Stop interrupts it at any time.
 */
export function AgentPanel({ datasets, getContext, actions, activeName, hasSql, hasError }: {
  datasets: Dataset[];
  getContext: () => AgentContext;
  actions: NotebookActions;
  activeName?: string;
  hasSql: boolean;
  hasError: boolean;
}) {
  const a = useAgent(getContext, actions);
  const [input, setInput] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const starters = useApi<{ questions: string[] }>('/ai/suggestions').data?.questions ?? [];

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [a.messages, a.elapsed > 0 && Math.floor(a.elapsed)]);
  useEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; } }, [input]);

  const at = mentionAt(input);
  const mentions = useMemo(() => (at ? datasets.filter((d) => d.name.toLowerCase().includes(at[1].toLowerCase())).slice(0, 6) : []), [at, datasets]);
  const pick = (name: string) => { setInput((t) => t.replace(/@[\w.-]*$/, name + ' ')); box.current?.focus(); };
  const submit = (text = input) => { if (!text.trim() || a.busy) return; a.send(text); setInput(''); };

  const chips = [
    ...(hasError ? ['Fix the error in this cell'] : []),
    ...(hasSql ? ['Explain this query step by step', 'Optimize this query without changing its result'] : []),
    ...starters.slice(0, hasSql ? 2 : 4),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-2 text-xs">
        <div className="flex rounded-md bg-muted p-0.5" role="group" aria-label="Mode">
          {(['agent', 'ask'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={a.prefs.mode === m} onClick={() => a.setPrefs({ mode: m })}
              title={m === 'agent' ? 'Can add and edit notebook cells' : 'Answers only; never touches the notebook'}
              className={cn('flex items-center gap-1 rounded-sm px-2 py-1 font-medium', a.prefs.mode === m ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
              {m === 'agent' ? <Bot className="size-3" /> : <MessageSquare className="size-3" />}{m === 'agent' ? 'Agent' : 'Ask'}
            </button>
          ))}
        </div>
        {a.prefs.mode === 'agent' && (
          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground" title="Apply the agent's notebook changes without asking">
            <input type="checkbox" checked={a.prefs.autoApprove} onChange={(e) => a.setPrefs({ autoApprove: e.target.checked })} /> Auto-apply
          </label>
        )}
        <div className="ml-auto flex items-center">
          <ChatHistory items={a.chats.items} activeId={a.chats.activeId} busy={a.busy} onOpen={a.chats.open} onRename={a.chats.rename} onRemove={a.chats.remove} />
          <button type="button" onClick={a.newChat} disabled={a.busy || a.messages.length === 0} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40" title="Start a new chat (the current one stays in History)">
            <Plus className="size-3.5" /> New
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {a.messages.length === 0 && (
          <div className="space-y-3 pt-2 text-sm">
            <p className="text-muted-foreground">
              {a.prefs.mode === 'agent'
                ? 'Tell me what you need. I can look at your tables, run queries to check my work, and add or edit notebook cells. Type @ to pick a table.'
                : 'Ask about your data. I will look at the tables and run read-only queries, but I will not change the notebook. Type @ to pick a table.'}
            </p>
            <div className="flex flex-col gap-1.5">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => submit(c)} className="rounded-md border bg-card px-2.5 py-1.5 text-left text-xs hover:bg-accent">{c}</button>
              ))}
            </div>
          </div>
        )}
        {a.messages.map((m, i) => (
          <div key={m.id} className="flex flex-col">
            <AgentMessage m={m} actions={actions} elapsed={a.elapsed} onApprove={(n) => a.approve(m.id, n)} onUndo={(n) => a.undo(m.id, n)}
              onRetry={m.role === 'assistant' && m.status !== 'running' && !a.busy && a.messages[i - 1]?.role === 'user' ? () => a.send(a.messages[i - 1].text) : undefined} />
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="relative pt-2">
        {mentions.length > 0 && (
          <ul className="absolute inset-x-0 bottom-full mb-1 max-h-44 overflow-auto rounded-md border bg-popover p-1 shadow-md" role="listbox" aria-label="Tables">
            {mentions.map((d) => (
              <li key={d.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); pick(d.name); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent">
                <Table2 className="size-3.5 text-primary" />{d.name}<span className="ml-auto text-muted-foreground">{d.row_count?.toLocaleString()}</span>
              </button></li>
            ))}
          </ul>
        )}
        <div className="rounded-lg border bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
          <textarea ref={box} value={input} rows={2} onChange={(e) => setInput(e.target.value)} aria-label="Message the assistant"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !mentions.length) { e.preventDefault(); submit(); } if (e.key === 'Tab' && mentions.length) { e.preventDefault(); pick(mentions[0].name); } }}
            placeholder={a.prefs.mode === 'agent' ? 'What should I build or find out?  (@ for tables, Shift+Enter for a new line)' : 'Ask about your data…'}
            className="block max-h-40 w-full resize-none bg-transparent px-3 pt-2 text-sm outline-none" />
          <div className="flex items-center gap-2 px-2 pb-1.5 text-[11px] text-muted-foreground">
            <ModelPicker disabled={a.busy} />
            {activeName && <span className="mono rounded bg-muted px-1.5 py-0.5" title="The assistant sees this cell">{activeName}</span>}
            {a.busy && <span className="flex items-center gap-1 tabular-nums"><Timer className="size-3" />{a.elapsed.toFixed(1)} s</span>}
            {a.busy
              ? <button type="button" onClick={a.stop} aria-label="Stop" className="ml-auto flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive hover:bg-destructive/20"><Square className="size-3 fill-current" /> Stop</button>
              : <button type="button" onClick={() => submit()} disabled={!input.trim()} aria-label="Send" className="ml-auto grid size-7 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-4" /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

