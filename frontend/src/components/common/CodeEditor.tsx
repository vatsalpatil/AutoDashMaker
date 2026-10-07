import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror, { EditorView, keymap, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { sql, type SQLNamespace } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Prec, type Extension } from '@codemirror/state';

export interface CodeEditorHandle {
  /** Insert text at the cursor (replacing any selection) and focus the editor. */
  insertText: (text: string, spaced?: boolean) => void;
  focus: () => void;
}

/** Colours come from the app's design tokens, so the editor follows the active theme (light, dark, every preset). */
const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--primary)', padding: '8px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted-foreground)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in oklab, var(--primary) 28%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--primary)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-tooltip': { backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: '8px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--primary) 25%, transparent)', outline: 'none' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--muted)', border: 'none', color: 'var(--muted-foreground)' },
});

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: 'var(--primary)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--success)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--warning)' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--info)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className], color: 'var(--chart-4)' },
  { tag: [t.punctuation, t.bracket, t.separator], color: 'var(--muted-foreground)' },
]));

/** CodeMirror 6 editor: JSON or SQL (with table/column completion from `schema`), themed from design tokens. */
export const CodeEditor = forwardRef<CodeEditorHandle, {
  value: string;
  onChange?: (v: string) => void;
  language?: 'json' | 'sql' | 'text';
  readOnly?: boolean;
  placeholder?: string;
  /** SQL completion: `{ table: ['col', …] }` */
  schema?: SQLNamespace;
  /** Ctrl/Cmd+Enter */
  onRun?: () => void;
  /** Shift+Enter (e.g. run and move to the next cell) */
  onRunNext?: () => void;
  onFocus?: () => void;
  minHeight?: string;
  maxHeight?: string;
  height?: string;
  lineNumbers?: boolean;
  className?: string;
}>(function CodeEditor({
  value, onChange, language = 'text', readOnly, placeholder, schema, onRun, onRunNext, onFocus,
  minHeight, maxHeight, height, lineNumbers = true, className,
}, ref) {
  const cm = useRef<ReactCodeMirrorRef>(null);
  useImperativeHandle(ref, () => ({
    insertText(text, spaced = false) {
      const view = cm.current?.view;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const prev = from > 0 ? view.state.sliceDoc(from - 1, from) : '';
      const lead = spaced && prev && !/[\s(,.]/.test(prev) ? ' ' : '';  // keep the new token apart from the previous one
      view.dispatch({ changes: { from, to, insert: lead + text }, selection: { anchor: from + lead.length + text.length }, scrollIntoView: true });
      view.focus();
    },
    focus: () => cm.current?.view?.focus(),
  }), []);

  const extensions = useMemo<Extension[]>(() => {
    const ext: Extension[] = [theme, highlight, EditorView.lineWrapping];
    if (language === 'json') ext.push(json());
    if (language === 'sql') ext.push(sql({ schema, upperCaseKeywords: true }));
    ext.push(Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: () => { onRun?.(); return !!onRun; } },
      { key: 'Shift-Enter', run: () => { onRunNext?.(); return !!onRunNext; } },
    ])));
    return ext;
  }, [language, schema, onRun, onRunNext]);

  return (
    <CodeMirror
      ref={cm}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      readOnly={readOnly}
      editable={!readOnly}
      placeholder={placeholder}
      extensions={extensions}
      theme="none"
      minHeight={minHeight}
      maxHeight={maxHeight}
      height={height}
      className={className}
      basicSetup={{ lineNumbers, foldGutter: lineNumbers, highlightActiveLine: !readOnly, autocompletion: language === 'sql', searchKeymap: true }}
    />
  );
});
