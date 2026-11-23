import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Code2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Markdown } from '@/components/common/Markdown';
import type { NotebookCellProps } from './NotebookCell';
import { CellGutter } from './CellGutter';

const iconBtn = 'rounded p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent ';

/** A Markdown (text) cell: rendered as a note; double-click to edit, Ctrl/Shift+Enter to render. Never sent to the server. */
export function MarkdownCell(p: NotebookCellProps) {
  const { cell, active } = p;
  const [editing, setEditing] = useState(!cell.sql.trim());
  const done = () => { if (cell.sql.trim()) setEditing(false); };

  return (
    <section onFocusCapture={p.onFocus} onMouseDown={p.onFocus}
      className={`group flex border-b border-border border-l-[3px] ${active ? 'border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/10' : 'border-l-transparent'}`}>
      <CellGutter index={p.index} kind="md" />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center px-3 pt-1 ${editing ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
          <span className="text-[11px] text-muted-foreground">Text · Markdown</span>
          <div className="ml-auto flex items-center">
            {editing
              ? <button type="button" className={iconBtn} onClick={done} disabled={!cell.sql.trim()} title="Done (Ctrl+Enter)"><Check className="h-4 w-4" /></button>
              : <button type="button" className={iconBtn} onClick={() => setEditing(true)} title="Edit text"><Pencil className="h-4 w-4" /></button>}
            <button type="button" className={iconBtn} onClick={p.onToggleKind} title="Turn into a SQL cell"><Code2 className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={() => p.onMove(-1)} disabled={p.index === 0} title="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={() => p.onMove(1)} disabled={p.index === p.total - 1} title="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={p.onAddBelow} title="Add SQL cell below"><Plus className="h-4 w-4" /></button>
            <button type="button" className={`${iconBtn} hover:!text-destructive`} onClick={p.onDelete} title="Delete cell"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        {editing ? (
          <CodeEditor ref={p.registerRef} value={cell.sql} onChange={p.onSql} language="text" lineNumbers={false}
            onRun={done} onRunNext={() => { done(); p.onRunAndNext(); }} onFocus={p.onFocus}
            minHeight="3rem" maxHeight="24rem" placeholder="# Title — write notes in Markdown: **bold**, *italic*, `code`, - lists, | tables |" />
        ) : (
          <div onDoubleClick={() => setEditing(true)} title="Double-click to edit" className="cursor-text px-4 pb-3 pt-1 text-sm">
            <Markdown text={cell.sql} />
          </div>
        )}
      </div>
    </section>
  );
}
