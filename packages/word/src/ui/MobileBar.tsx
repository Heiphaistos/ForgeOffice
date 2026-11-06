// Mise en forme tactile : barre defilante au-dessus du clavier virtuel (la mini-barre pres de la selection est la MiniToolbar de l'application).
import { redo, undo } from 'prosemirror-history';
import { KeyboardBar, colorMenuItems, nextFontSize, type KeyboardBarItem, type MenuItem } from '@forgeoffice/ui';
import { styleDisplayName } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { BULLETS, indent, setParagraph, setRunProp } from '../editor/commands.ts';
import { highlightHex, nearestHighlight } from '../editor/css.ts';
import { colorHex, quickStyles } from '../ribbon/shared.ts';

export function MobileBar({ c }: { c: Ctl }) {
  const { sel, act } = c;
  const r = sel.run;
  const p = sel.para;
  const cmd = T.cmd;
  const align = (a: 'left' | 'center' | 'right' | 'justify', label: string, icon: 'text_align_left' | 'text_align_center' | 'text_align_right' | 'text_align_justify'): KeyboardBarItem => ({
    id: `al-${a}`, label, icon, pressed: (p.alignment ?? 'left') === a, onClick: () => c.run(setParagraph({ props: { alignment: a } })),
  });
  const fontColor = colorHex(r);
  const highlight = r.highlight && r.highlight !== 'none' ? highlightHex(r.highlight) : null;
  const pickColor = (hex: string | null): void => { c.run(setRunProp('color', hex ? { rgb: hex.replace('#', '').toUpperCase() } : undefined)); };
  const styles: MenuItem[] = quickStyles(c.meta).map((s) => ({ id: s.id, label: styleDisplayName(s), checked: (sel.charStyle ?? sel.styleId) === s.id ? true : undefined, onClick: () => void act.applyStyle(s.id) }));
  const items: KeyboardBarItem[] = [
    { id: 'undo', label: T.qat.undo, icon: 'arrow_undo', disabled: !sel.canUndo, onClick: () => c.run(undo) },
    { id: 'redo', label: T.qat.redo, icon: 'arrow_redo', disabled: !sel.canRedo, onClick: () => c.run(redo) },
    { id: 'bold', label: cmd.bold, icon: 'text_bold', pressed: !!r.bold, separator: true, onClick: () => c.run(setRunProp('bold', !r.bold)) },
    { id: 'italic', label: cmd.italic, icon: 'text_italic', pressed: !!r.italic, onClick: () => c.run(setRunProp('italic', !r.italic)) },
    { id: 'underline', label: cmd.underline, icon: 'text_underline', pressed: !!r.underline && r.underline !== 'none', onClick: () => c.run(setRunProp('underline', r.underline && r.underline !== 'none' ? undefined : 'single')) },
    { id: 'strike', label: cmd.strike, icon: 'text_strikethrough', pressed: !!r.strike, onClick: () => c.run(setRunProp('strike', !r.strike)) },
    { id: 'fontcolor', label: cmd.fontColor, icon: 'text_color', swatch: fontColor ?? '#000000', items: colorMenuItems(cmd.autoColor, pickColor, fontColor) },
    { id: 'highlight', label: cmd.highlight, icon: 'highlight', swatch: highlight ?? '#FFFF00', items: colorMenuItems(cmd.noColor, (hex) => c.run(setRunProp('highlight', hex ? nearestHighlight(hex) : undefined)), highlight) },
    { id: 'shrink', label: cmd.shrink, text: 'A-', onClick: () => c.run(setRunProp('size', nextFontSize(r.size ?? 11, -1))) },
    { id: 'grow', label: cmd.grow, text: 'A+', onClick: () => c.run(setRunProp('size', nextFontSize(r.size ?? 11, 1))) },
    { ...align('left', cmd.alignLeft, 'text_align_left'), separator: true },
    align('center', cmd.center, 'text_align_center'),
    align('right', cmd.alignRight, 'text_align_right'),
    align('justify', cmd.justify, 'text_align_justify'),
    { id: 'bullets', label: cmd.bullets, icon: 'text_bullet_list_ltr', pressed: !!p.numbering, separator: true, onClick: () => act.list(p.numbering ? null : { kind: 'bullet', char: BULLETS[0] }) },
    { id: 'numbering', label: cmd.numbering, icon: 'text_number_list_ltr', onClick: () => act.list({ kind: 'number', format: 'decimal', text: '%1.' }) },
    { id: 'outdent', label: cmd.outdent, icon: 'text_indent_decrease_ltr', onClick: () => c.run(indent(-1)) },
    { id: 'indent', label: cmd.indent, icon: 'text_indent_increase_ltr', onClick: () => c.run(indent(1)) },
    { id: 'styles', label: T.groups.styles, icon: 'text_font', separator: true, items: styles },
  ];
  return <KeyboardBar items={items} scope=".fo-doc" overflow="scroll" />;
}
