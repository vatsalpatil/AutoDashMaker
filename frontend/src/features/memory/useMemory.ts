import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';

export interface MemoryFile { name: string; size: number; updated_at: string; lines: number; preview: string; main: boolean }
export interface MemoryOverview { enabled: boolean; files: MemoryFile[]; prompt_chars: number; prompt_limit: number }

const MAIN = 'MEMORY.md';
const enc = (name: string) => encodeURIComponent(name);

/** State + actions for the AI memory page: the file list, the open file and its unsaved draft. */
export function useMemory() {
  const overview = useApi<MemoryOverview>('/memory');
  const [open, setOpen] = useState(MAIN);
  const [saved, setSaved] = useState('');      // content on the server
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);   // bump to re-read the open file
  const dirty = draft !== saved;

  useEffect(() => {
    let live = true;
    api.get<{ content: string }>(`/memory/files/${enc(open)}`)
      .then((r) => { if (live) { setSaved(r.content); setDraft(r.content); } })
      .catch(() => { if (live) { setSaved(''); setDraft(''); } });
    return () => { live = false; };
  }, [open, version]);

  const refresh = () => { overview.reload(); setVersion((v) => v + 1); };

  const [save, saveState] = useAsyncAction(async () => {
    await api.put(`/memory/files/${enc(open)}`, { content: draft });
    setSaved(draft);
    overview.reload();
  });
  const [create, createState] = useAsyncAction(async (name: string) => {
    const file = /\.md$/i.test(name.trim()) ? name.trim() : `${name.trim()}.md`;
    await api.put(`/memory/files/${enc(file)}`, { content: `# ${file.replace(/\.md$/i, '')}\n\n- ` });
    overview.reload();
    setOpen(file);
  });
  const [remove, removeState] = useAsyncAction(async (name: string) => {
    await api.del(`/memory/files/${enc(name)}`);
    if (name === open && name !== MAIN) setOpen(MAIN);
    refresh();
  });
  const [rename, renameState] = useAsyncAction(async (name: string, to: string) => {
    const r = await api.post<{ name: string }>(`/memory/files/${enc(name)}/rename`, { name: to });
    overview.reload();
    if (name === open) setOpen(r.name);
  });
  const [remember, rememberState] = useAsyncAction(async (note: string) => {
    await api.post('/memory/remember', { note });
    if (open === MAIN && !dirty) refresh(); else overview.reload();
  });
  const [toggle] = useAsyncAction(async (enabled: boolean) => { await api.put('/memory/settings', { enabled }); overview.reload(); });

  const error = overview.error || saveState.error || createState.error || removeState.error || renameState.error || rememberState.error;
  return {
    overview, open, setOpen, draft, setDraft, dirty, save, saving: saveState.busy, create, remove, rename,
    remember, remembering: rememberState.busy, toggle, error,
  };
}

export type MemoryState = ReturnType<typeof useMemory>;
