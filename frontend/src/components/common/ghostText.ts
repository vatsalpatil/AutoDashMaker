import { Prec, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type ViewUpdate } from '@codemirror/view';
import { acceptCompletion } from '@codemirror/autocomplete';

/**
 * Inline ghost-text suggestions (Copilot-style): grey text after the cursor, Tab accepts it, Esc hides it.
 * `getSuggest()` is read on every keystroke, so the caller can swap the predictor without rebuilding the editor.
 */

type Ghost = { pos: number; text: string } | null;
const setGhost = StateEffect.define<Ghost>();

class GhostWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(o: GhostWidget) { return o.text === this.text; }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-ghost';
    el.textContent = this.text;
    el.title = 'Tab to accept';
    return el;
  }
  ignoreEvent() { return true; }
}

const ghostField = StateField.define<Ghost>({
  create: () => null,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    return tr.docChanged || tr.selection ? null : v;
  },
  provide: (f) => EditorView.decorations.from(f, (g) => (g
    ? Decoration.set([Decoration.widget({ widget: new GhostWidget(g.text), side: 1 }).range(g.pos)])
    : Decoration.none)),
});

function accept(view: EditorView): boolean {
  const g = view.state.field(ghostField, false);
  if (!g) return false;
  view.dispatch({ changes: { from: g.pos, insert: g.text }, selection: { anchor: g.pos + g.text.length }, scrollIntoView: true, userEvent: 'input.complete' });
  return true;
}

/** Instant (local) suggestion, plus an optional slower one (e.g. an AI model) asked after a short pause. */
export interface GhostSource {
  local?: (before: string) => string | null;
  remote?: (before: string, after: string, signal: AbortSignal) => Promise<string | null>;
}

const REMOTE_PAUSE = 150;   // ms of no typing before asking the remote source
const LOCAL_ENOUGH = 14;    // a local suggestion at least this long is kept without asking the remote one

export function ghostText(getSource: () => GhostSource | undefined): Extension {
  const plugin = ViewPlugin.fromClass(class {
    timer: ReturnType<typeof setTimeout> | undefined;
    remoteTimer: ReturnType<typeof setTimeout> | undefined;
    abort: AbortController | undefined;
    constructor(readonly view: EditorView) {}
    update(u: ViewUpdate) {
      if (!u.docChanged && !u.selectionSet && !u.focusChanged) return;
      this.cancel();
      this.timer = setTimeout(() => this.compute(), 60);
    }
    cancel() { clearTimeout(this.timer); clearTimeout(this.remoteTimer); this.abort?.abort(); this.abort = undefined; }
    show(ghost: Ghost) {
      const cur = this.view.state.field(ghostField, false);
      if (cur?.text !== ghost?.text || cur?.pos !== ghost?.pos) this.view.dispatch({ effects: setGhost.of(ghost) });
    }
    compute() {
      const { view } = this;
      const { state } = view;
      const sel = state.selection.main;
      const src = getSource();
      const line = state.doc.lineAt(sel.head);
      const after = state.sliceDoc(sel.head, line.to);
      if (!src || !view.hasFocus || !sel.empty || after.trim()) return this.show(null);
      const before = state.sliceDoc(0, sel.head);
      const local = src.local?.(before) ?? null;
      this.show(local ? { pos: sel.head, text: local } : null);
      if (!src.remote || (local && local.length >= LOCAL_ENOUGH) || !before.trim()) return;
      const doc = state.doc, head = sel.head;
      this.remoteTimer = setTimeout(() => {
        const ctl = new AbortController();
        this.abort = ctl;
        src.remote!(before, state.sliceDoc(sel.head), ctl.signal).then((text) => {
          // only if nothing changed while the model was thinking
          if (ctl.signal.aborted || !text || view.state.doc !== doc || view.state.selection.main.head !== head) return;
          this.show({ pos: head, text });
        }).catch(() => { /* autocomplete fails quietly */ });
      }, REMOTE_PAUSE);
    }
    destroy() { this.cancel(); }
  });

  return [
    ghostField,
    plugin,
    EditorView.baseTheme({ '.cm-ghost': { opacity: '0.45', fontStyle: 'italic', pointerEvents: 'none', whiteSpace: 'pre-wrap' } }),
    Prec.highest(keymap.of([
      // Tab: take the ghost suggestion, otherwise the highlighted item of the popup list
      { key: 'Tab', run: (v) => accept(v) || acceptCompletion(v) },
      { key: 'ArrowRight', run: (v) => (v.state.selection.main.head === v.state.doc.length || !v.state.sliceDoc(v.state.selection.main.head, v.state.doc.lineAt(v.state.selection.main.head).to).trim()) && accept(v) },
      { key: 'Escape', run: (v) => { if (!v.state.field(ghostField, false)) return false; v.dispatch({ effects: setGhost.of(null) }); return true; } },
    ])),
  ];
}
