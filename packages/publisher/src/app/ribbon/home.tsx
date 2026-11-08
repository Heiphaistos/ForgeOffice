// Onglet Accueil : Presse-papiers, Police, Paragraphe, Styles, Objets, Organiser, Modification.
import { FONT_SIZE_OPTIONS, nextFontSize, validateFontSize, type MenuItem, type RibbonControl, type RibbonTab } from '@forgeoffice/ui';
import type { ParagraphProps, RunProps } from '@forgeoffice/pptx';
import { MAJOR, MINOR, sc } from '../../build.ts';
import { S } from '../../strings.ts';
import { applyCase, applyParagraph, applyRun, colorFromHex, currentParagraph, currentRun, hexOf, insertPicture, themeSwatches } from '../ops.ts';
import { applyStyle } from '../stylesops.ts';
import { arrangeMenus, shapeMenu, type TabContext } from './common.tsx';

/** Styles de texte (galerie Styles) : caracteres + paragraphe, couleurs et polices du modele. */
export const TEXT_STYLES: ReadonlyArray<{ id: keyof typeof S.styles; run: RunProps; para: ParagraphProps; sample: { fontWeight?: number; fontSize: number; color: string; fontStyle?: string; fontFamily: string } }> = [
  { id: 'title', run: { font: MAJOR, size: 36, bold: true, color: sc('tx2') }, para: { spaceAfter: { type: 'pts', value: 6 } }, sample: { fontWeight: 700, fontSize: 16, color: 'var(--pub-tx2)', fontFamily: 'Georgia, serif' } },
  { id: 'heading1', run: { font: MAJOR, size: 20, bold: true, color: sc('accent1') }, para: { spaceBefore: { type: 'pts', value: 12 }, spaceAfter: { type: 'pts', value: 4 } }, sample: { fontWeight: 700, fontSize: 13, color: 'var(--pub-accent)', fontFamily: 'Georgia, serif' } },
  { id: 'heading2', run: { font: MAJOR, size: 14, bold: true, color: sc('tx2') }, para: { spaceBefore: { type: 'pts', value: 8 }, spaceAfter: { type: 'pts', value: 3 } }, sample: { fontWeight: 700, fontSize: 11, color: 'var(--pub-tx2)', fontFamily: 'Georgia, serif' } },
  { id: 'body', run: { font: MINOR, size: 11, bold: false, italic: false, color: sc('tx1') }, para: { spaceAfter: { type: 'pts', value: 6 } }, sample: { fontSize: 10, color: '#222', fontFamily: 'Segoe UI, sans-serif' } },
  { id: 'quote', run: { font: MINOR, size: 14, italic: true, color: sc('accent1') }, para: { align: 'ctr', spaceBefore: { type: 'pts', value: 6 }, spaceAfter: { type: 'pts', value: 6 } }, sample: { fontSize: 10, fontStyle: 'italic', color: 'var(--pub-accent)', fontFamily: 'Segoe UI, sans-serif' } },
  { id: 'caption', run: { font: MINOR, size: 8.5, italic: true, color: sc('tx2') }, para: {}, sample: { fontSize: 9, fontStyle: 'italic', color: '#555', fontFamily: 'Segoe UI, sans-serif' } },
  { id: 'accent', run: { font: MAJOR, size: 12, bold: true, caps: 'all', spacing: 1, color: sc('accent2') }, para: {}, sample: { fontWeight: 700, fontSize: 10, color: 'var(--pub-accent2)', fontFamily: 'Segoe UI, sans-serif' } },
];

export function homeTab({ ed, app }: TabContext): RibbonTab {
  const run = currentRun(ed);
  const para = currentParagraph(ed);
  const hasText = ed.selection.ids.length > 0 || !!ed.selection.text;
  const font = run.font?.startsWith('+') ? (run.font.startsWith('+mj') ? ed.ctx.theme.fonts.major.latin : ed.ctx.theme.fonts.minor.latin) : (run.font ?? ed.ctx.theme.fonts.minor.latin);
  const size = run.size ?? 11;
  const bullet = para.bullet;
  const arrange = arrangeMenus(ed, false);
  const setBullet = (b: ParagraphProps['bullet'] | null): void =>
    applyParagraph(ed, (props) => ({ ...props, bullet: b ?? { type: 'none' }, marginLeft: b && b.type !== 'none' ? 18 : 0, indent: b && b.type !== 'none' ? -18 : 0 }), 'bullets');
  const caseItems: MenuItem[] = (['sentence', 'lower', 'upper', 'title', 'toggle'] as const).map((m) => ({ id: m, label: S.caseNames[m], onClick: () => applyCase(ed, m) }));
  const spacing: MenuItem[] = [1, 1.15, 1.5, 2, 3].map((v) => ({ id: String(v), label: String(v).replace('.', ','), checked: para.lineSpacing?.type === 'pct' && Math.abs(para.lineSpacing.value - v * 100) < 1, onClick: () => applyParagraph(ed, { lineSpacing: { type: 'pct', value: v * 100 } }) }));
  const fontControls: RibbonControl[] = [
    {
      kind: 'row', id: 'fontTop', controls: [
        { kind: 'font', id: 'font', label: S.groups.font, value: font, width: 150, disabled: !hasText, onChange: (f) => applyRun(ed, { font: f }) },
        { kind: 'combo', id: 'size', label: S.cmd.size, value: String(Math.round(size * 10) / 10), options: FONT_SIZE_OPTIONS, editable: true, width: 56, validate: validateFontSize, disabled: !hasText, onChange: (v) => applyRun(ed, { size: Number(v) }) },
        { kind: 'button', id: 'grow', label: S.cmd.grow, icon: 'text_font_size', iconOnly: true, tooltip: { title: S.cmd.grow, shortcut: 'Ctrl+Maj+>' }, disabled: !hasText, onClick: () => applyRun(ed, { size: nextFontSize(size, 1) }) },
        { kind: 'button', id: 'shrink', label: S.cmd.shrink, icon: 'text_font_size', iconOnly: true, tooltip: { title: S.cmd.shrink, shortcut: 'Ctrl+Maj+<' }, disabled: !hasText, onClick: () => applyRun(ed, { size: nextFontSize(size, -1) }) },
        { kind: 'button', id: 'clear', label: S.cmd.clear, icon: 'text_clear_formatting', iconOnly: true, disabled: !hasText, onClick: () => applyRun(ed, { bold: null, italic: null, underline: null, strike: null, color: null, highlight: null, spacing: null, caps: null, baseline: null, effects: null, textFill: null, outline: null }) },
      ],
    },
    {
      kind: 'row', id: 'fontRow', controls: [
        { kind: 'toggle', id: 'bold', label: S.cmd.bold, icon: 'text_bold', pressed: !!run.bold, tooltip: { title: S.cmd.bold, shortcut: 'Ctrl+G' }, disabled: !hasText, onToggle: (p) => applyRun(ed, { bold: p || null }) },
        { kind: 'toggle', id: 'italic', label: S.cmd.italic, icon: 'text_italic', pressed: !!run.italic, tooltip: { title: S.cmd.italic, shortcut: 'Ctrl+I' }, disabled: !hasText, onToggle: (p) => applyRun(ed, { italic: p || null }) },
        { kind: 'toggle', id: 'underline', label: S.cmd.underline, icon: 'text_underline', pressed: !!run.underline && run.underline !== 'none', tooltip: { title: S.cmd.underline, shortcut: 'Ctrl+U' }, disabled: !hasText, onToggle: (p) => applyRun(ed, { underline: p ? 'sng' : null }) },
        { kind: 'toggle', id: 'strike', label: S.cmd.strike, icon: 'text_strikethrough', pressed: !!run.strike && run.strike !== 'noStrike', disabled: !hasText, onToggle: (p) => applyRun(ed, { strike: p ? 'sngStrike' : null }) },
        { kind: 'toggle', id: 'sub', label: S.cmd.sub, icon: 'text_subscript', pressed: (run.baseline ?? 0) < 0, disabled: !hasText, onToggle: (p) => applyRun(ed, { baseline: p ? -25 : null }) },
        { kind: 'toggle', id: 'sup', label: S.cmd.sup, icon: 'text_superscript', pressed: (run.baseline ?? 0) > 0, disabled: !hasText, onToggle: (p) => applyRun(ed, { baseline: p ? 30 : null }) },
        { kind: 'menu', id: 'case', label: S.cmd.changeCase, icon: 'text_change_case', iconOnly: true, disabled: !hasText, items: caseItems },
        { kind: 'color', id: 'highlight', label: S.cmd.highlight, icon: 'highlight', value: run.highlight ? hexOf(ed, run.highlight) : '#FFFF00', emptyMode: 'none', disabled: !hasText, onChange: (c) => applyRun(ed, { highlight: c ? colorFromHex(ed, c) : null }) },
        { kind: 'color', id: 'color', label: S.cmd.fontColor, icon: 'text_color', value: run.color ? hexOf(ed, run.color) : '#C00000', themeColors: themeSwatches(ed), disabled: !hasText, onChange: (c) => applyRun(ed, { color: c ? colorFromHex(ed, c) : null }) },
      ],
    },
  ];
  const paraControls: RibbonControl[] = [
    {
      kind: 'row', id: 'paraTop', controls: [
        { kind: 'toggle', id: 'bullets', label: S.cmd.bullets, icon: 'text_bullet_list_ltr', iconOnly: true, pressed: bullet?.type === 'char', disabled: !hasText, onToggle: (p) => setBullet(p ? { type: 'char', char: '•' } : null) },
        { kind: 'toggle', id: 'numbers', label: S.cmd.numbering, icon: 'text_number_list_ltr', iconOnly: true, pressed: bullet?.type === 'auto', disabled: !hasText, onToggle: (p) => setBullet(p ? { type: 'auto', scheme: 'arabicPeriod' } : null) },
        { kind: 'button', id: 'outdent', label: S.cmd.indentLess, icon: 'text_indent_decrease_ltr', iconOnly: true, disabled: !hasText, onClick: () => applyParagraph(ed, (p) => ({ ...p, marginLeft: Math.max(0, (p.marginLeft ?? 0) - 18) })) },
        { kind: 'button', id: 'indent', label: S.cmd.indentMore, icon: 'text_indent_increase_ltr', iconOnly: true, disabled: !hasText, onClick: () => applyParagraph(ed, (p) => ({ ...p, marginLeft: (p.marginLeft ?? 0) + 18 })) },
        { kind: 'menu', id: 'spacing', label: S.cmd.lineSpacing, icon: 'text_line_spacing', iconOnly: true, disabled: !hasText, items: spacing },
      ],
    },
    {
      kind: 'row', id: 'paraAlign', controls: (['l', 'ctr', 'r', 'just'] as const).map((a) => ({
        kind: 'toggle' as const, id: `al-${a}`, label: a === 'l' ? S.cmd.alignLeft : a === 'ctr' ? S.cmd.alignCenter : a === 'r' ? S.cmd.alignRight : S.cmd.justify,
        icon: a === 'l' ? ('text_align_left' as const) : a === 'ctr' ? ('text_align_center' as const) : a === 'r' ? ('text_align_right' as const) : ('text_align_justify' as const),
        iconOnly: true, pressed: (para.align ?? 'l') === a, disabled: !hasText, onToggle: () => applyParagraph(ed, { align: a }),
      })),
    },
  ];
  return {
    id: 'home',
    label: S.tabs.home,
    keytip: 'L',
    groups: [
      {
        id: 'clipboard', label: S.groups.clipboard, icon: 'clipboard_paste', controls: [
          { kind: 'split', id: 'paste', label: S.cmd.paste, icon: 'clipboard_paste', size: 'large', tooltip: { title: S.cmd.paste, shortcut: 'Ctrl+V' }, onClick: app.paste, items: [{ id: 'keep', label: S.cmd.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: app.paste }, { id: 'plain', label: S.cmd.pasteText, icon: 'document_text', onClick: app.pasteText }] },
          { kind: 'button', id: 'cut', label: S.cmd.cut, icon: 'cut', tooltip: { title: S.cmd.cut, shortcut: 'Ctrl+X' }, disabled: !hasText, onClick: app.cut },
          { kind: 'button', id: 'copy', label: S.cmd.copy, icon: 'copy', tooltip: { title: S.cmd.copy, shortcut: 'Ctrl+C' }, disabled: !hasText, onClick: app.copy },
          { kind: 'toggle', id: 'painter', label: S.cmd.painter, icon: 'paint_brush', pressed: app.painterActive, disabled: !hasText && !app.painterActive, onToggle: app.copyFormat },
        ],
      },
      { id: 'font', label: S.groups.font, icon: 'text_font', launcher: { label: S.cmd.fontDialog, onClick: () => ed.setUi({ dialog: 'font' }) }, controls: fontControls },
      { id: 'paragraph', label: S.groups.paragraph, icon: 'text_paragraph', launcher: { label: S.cmd.paragraphDialog, onClick: () => ed.setUi({ dialog: 'paragraph' }) }, controls: paraControls },
      {
        id: 'styles', label: S.groups.styles, icon: 'text_effects', controls: [
          {
            kind: 'gallery', id: 'styles', label: S.groups.styles, itemWidth: 76, columns: 4, disabled: !hasText,
            items: [
              ...TEXT_STYLES.map((st) => ({ id: st.id, label: S.styles[st.id], sample: S.styles[st.id], style: st.sample })),
              ...ed.pub.styles.map((st) => ({ id: `u:${st.id}`, label: st.name, sample: st.name, style: { fontSize: Math.min(16, Math.max(9, st.run.size ?? 11)), fontWeight: st.run.bold ? 700 : 400, fontStyle: st.run.italic ? 'italic' : 'normal', color: st.run.color ? hexOf(ed, st.run.color) : '#222', fontFamily: 'Segoe UI, sans-serif' } })),
            ],
            onSelect: (id) => {
              const custom = id.startsWith('u:') ? ed.pub.styles.find((x) => x.id === id.slice(2)) : undefined;
              if (custom) {
                applyStyle(ed, custom);
                return;
              }
              const st = TEXT_STYLES.find((x) => x.id === id);
              if (!st) return;
              applyRun(ed, { ...st.run, bold: st.run.bold ?? null, italic: st.run.italic ?? null, caps: st.run.caps ?? null, spacing: st.run.spacing ?? null }, 'style');
              applyParagraph(ed, st.para, 'style');
            },
          },
          { kind: 'menu', id: 'stylesMenu', label: S.cmd.manageStyles, icon: 'text_effects', items: [
            { id: 'new', label: S.cmd.newStyle, onClick: () => ed.setUi({ dialog: 'styles' }) },
            { id: 'manage', label: S.cmd.manageStyles, onClick: () => ed.setUi({ dialog: 'styles' }) },
          ] },
        ],
      },
      {
        id: 'objects', label: S.groups.objects, icon: 'shapes', controls: [
          { kind: 'button', id: 'textbox', label: S.cmd.textBox, icon: 'textbox', size: 'large', onClick: () => ed.setUi({ tool: { kind: 'textbox' } }) },
          { kind: 'button', id: 'picture', label: S.cmd.picture, icon: 'image', size: 'large', onClick: () => void insertPicture(ed) },
          { kind: 'menu', id: 'shapes', label: S.cmd.shapes, icon: 'shapes', size: 'large', items: shapeMenu(app) },
          { kind: 'button', id: 'table', label: S.cmd.table, icon: 'table', size: 'large', onClick: () => ed.setUi({ dialog: 'table' }) },
        ],
      },
      {
        id: 'arrange', label: S.groups.arrange, icon: 'layer', controls: [arrange.front, arrange.back, arrange.group, arrange.align, arrange.rotate],
      },
      {
        id: 'editing', label: S.groups.editing, icon: 'search', controls: [
          { kind: 'button', id: 'find', label: S.cmd.find, icon: 'search', tooltip: { title: S.cmd.find, shortcut: 'Ctrl+F' }, onClick: () => ed.setUi({ dialog: 'find' }) },
          { kind: 'button', id: 'replace', label: S.cmd.replace, icon: 'arrow_swap', tooltip: { title: S.cmd.replace, shortcut: 'Ctrl+H' }, onClick: () => ed.setUi({ dialog: 'replace' }) },
          { kind: 'button', id: 'selectAll', label: S.cmd.selectAll, icon: 'select_all_on', onClick: () => ed.setSelection({ ids: ed.pageShapes.map((s) => s.id) }) },
        ],
      },
    ],
  };
}

