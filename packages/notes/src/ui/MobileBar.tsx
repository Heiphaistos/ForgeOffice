// Barre de raccourcis de code au-dessus du clavier virtuel : Tabulation, parentheses et signes courants, fleches, Annuler / Retablir.
import { cursorCharLeft, cursorCharRight, cursorLineDown, cursorLineUp, indentLess, insertTab, redo, undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { KeyboardBar, type KeyboardBarItem } from '@forgeoffice/ui';
import type { Workspace } from '../workspace.ts';
import { S } from '../strings.ts';

const SIGNS = ['(', ')', '[', ']', '{', '}', '<', '>', '"', "'", '`', '=', '-', '_', '*', '#', '/', '\\', '|', ';', ':', ','] as const;

export function MobileBar({ ws }: { ws: Workspace }) {
  const run = (cmd: (v: EditorView) => boolean) => () => {
    const v = ws.view;
    if (v) cmd(v);
  };
  const insert = (text: string) => () => {
    const v = ws.view;
    if (v) v.dispatch(v.state.replaceSelection(text), { scrollIntoView: true, userEvent: 'input.type' });
  };
  const items: KeyboardBarItem[] = [
    { id: 'tab', label: S.touch.tab, text: 'Tab', onClick: run(insertTab) },
    { id: 'untab', label: S.touch.outdent, text: '⇤', onClick: run(indentLess) },
    { id: 'undo', label: S.touch.undo, icon: 'arrow_undo', separator: true, onClick: run(undo) },
    { id: 'redo', label: S.touch.redo, icon: 'arrow_redo', onClick: run(redo) },
    { id: 'left', label: S.touch.left, icon: 'arrow_left', separator: true, onClick: run(cursorCharLeft) },
    { id: 'right', label: S.touch.right, icon: 'arrow_right', onClick: run(cursorCharRight) },
    { id: 'up', label: S.touch.up, icon: 'arrow_up', onClick: run(cursorLineUp) },
    { id: 'down', label: S.touch.down, icon: 'arrow_down', onClick: run(cursorLineDown) },
    ...SIGNS.map((c, i): KeyboardBarItem => ({ id: `s${c}`, label: S.touch.insert(c), text: c, separator: i === 0, onClick: insert(c) })),
  ];
  return <KeyboardBar items={items} scope=".nt-editor" overflow="scroll" />;
}
