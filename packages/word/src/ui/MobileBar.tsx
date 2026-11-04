// Barre de mise en forme flottante au-dessus du clavier virtuel (telephone, tablette) : les commandes les plus utiles au doigt.
import { redo, undo } from 'prosemirror-history';
import { KeyboardBar, type KeyboardBarItem } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { BULLETS, indent, setParagraph, setRunProp } from '../editor/commands.ts';

export function MobileBar({ c }: { c: Ctl }) {
  const { sel, act } = c;
  const r = sel.run;
  const p = sel.para;
  const cmd = T.cmd;
  const align = (a: 'left' | 'center' | 'right', label: string, icon: 'text_align_left' | 'text_align_center' | 'text_align_right'): KeyboardBarItem => ({
    id: `al-${a}`, label, icon, pressed: (p.alignment ?? 'left') === a, onClick: () => c.run(setParagraph({ props: { alignment: a } })),
  });
  const items: KeyboardBarItem[] = [
    { id: 'undo', label: T.qat.undo, icon: 'arrow_undo', disabled: !sel.canUndo, onClick: () => c.run(undo) },
    { id: 'redo', label: T.qat.redo, icon: 'arrow_redo', disabled: !sel.canRedo, onClick: () => c.run(redo) },
    { id: 'bold', label: cmd.bold, icon: 'text_bold', pressed: !!r.bold, separator: true, onClick: () => c.run(setRunProp('bold', !r.bold)) },
    { id: 'italic', label: cmd.italic, icon: 'text_italic', pressed: !!r.italic, onClick: () => c.run(setRunProp('italic', !r.italic)) },
    { id: 'underline', label: cmd.underline, icon: 'text_underline', pressed: !!r.underline && r.underline !== 'none', onClick: () => c.run(setRunProp('underline', r.underline && r.underline !== 'none' ? undefined : 'single')) },
    { id: 'strike', label: cmd.strike, icon: 'text_strikethrough', pressed: !!r.strike, onClick: () => c.run(setRunProp('strike', !r.strike)) },
    { id: 'bullets', label: cmd.bullets, icon: 'text_bullet_list_ltr', pressed: !!p.numbering, separator: true, onClick: () => act.list(p.numbering ? null : { kind: 'bullet', char: BULLETS[0] }) },
    { id: 'numbering', label: cmd.numbering, icon: 'text_number_list_ltr', onClick: () => act.list({ kind: 'number', format: 'decimal', text: '%1.' }) },
    align('left', cmd.alignLeft, 'text_align_left'),
    align('center', cmd.center, 'text_align_center'),
    align('right', cmd.alignRight, 'text_align_right'),
    { id: 'outdent', label: cmd.outdent, icon: 'text_indent_decrease_ltr', separator: true, onClick: () => c.run(indent(-1)) },
    { id: 'indent', label: cmd.indent, icon: 'text_indent_increase_ltr', onClick: () => c.run(indent(1)) },
  ];
  return <KeyboardBar items={items} scope=".fo-doc" />;
}
