// Actions sur l'editeur : operations de lignes et de casse sur la selection (ou tout le document).
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { changeCase, dateTimeStamp, type CaseMode } from '../logic/lines.ts';

/** Applique `fn` aux lignes selectionnees ; sans selection, a tout le document (comme WinNote). */
export function transformLines(view: EditorView, fn: (lines: string[]) => string[]): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const sel = state.selection.main;
  const whole = sel.empty;
  const from = whole ? 0 : state.doc.lineAt(sel.from).from;
  const lastLine = state.doc.lineAt(sel.to > sel.from && state.doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to);
  const to = whole ? state.doc.length : lastLine.to;
  const before = state.sliceDoc(from, to);
  const after = fn(before.split('\n')).join('\n');
  if (after === before) return true;
  view.dispatch({
    changes: { from, to, insert: after },
    selection: whole ? undefined : EditorSelection.range(from, from + after.length),
    userEvent: 'input.lines',
    scrollIntoView: true,
  });
  return true;
}

/** Change la casse de chaque selection ; selection vide = mot sous le curseur. */
export function changeSelectionCase(view: EditorView, mode: CaseMode): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const tr = state.changeByRange((range) => {
    const r = range.empty ? (state.wordAt(range.head) ?? range) : range;
    const insert = changeCase(state.sliceDoc(r.from, r.to), mode);
    return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.range(r.from, r.from + insert.length) };
  });
  view.dispatch(state.update(tr, { userEvent: 'input.case' }));
  return true;
}

export function insertDateTime(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  view.dispatch(view.state.replaceSelection(dateTimeStamp(new Date())), { userEvent: 'input', scrollIntoView: true });
  return true;
}

export function selectedText(view: EditorView): string {
  const { state } = view;
  return state.selection.ranges.map((r) => state.sliceDoc(r.from, r.to)).join(state.lineBreak);
}

export async function copySelection(view: EditorView, cut: boolean): Promise<void> {
  const text = selectedText(view);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  if (cut && !view.state.readOnly) view.dispatch(view.state.replaceSelection(''), { userEvent: 'delete.cut' });
}

export async function pasteClipboard(view: EditorView): Promise<void> {
  const text = await navigator.clipboard.readText();
  if (!view.state.readOnly) view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
}

export function deleteSelection(view: EditorView): boolean {
  if (view.state.readOnly || view.state.selection.ranges.every((r) => r.empty)) return false;
  view.dispatch(view.state.replaceSelection(''), { userEvent: 'delete.selection' });
  return true;
}

/** Va a une ligne (1 = premiere) et la centre. */
export function goToLine(view: EditorView, line: number): void {
  const n = Math.min(Math.max(1, line), view.state.doc.lines);
  const pos = view.state.doc.line(n).from;
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  view.focus();
}
