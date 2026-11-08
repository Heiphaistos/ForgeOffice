// Onglet Accueil : presse-papiers, police, paragraphe, styles, modification.
import { AllSelection } from 'prosemirror-state';
import { FONT_SIZE_OPTIONS, nextFontSize, validateFontSize, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
import type { Alignment, UnderlineType } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { BULLETS, changeCase, clearRunFormatting, indent, setParagraph, setRunProp, setRunProps, type CaseMode } from '../editor/commands.ts';
import { nearestHighlight, highlightHex } from '../editor/css.ts';
import { colorHex, styleGallery } from './shared.ts';

export function homeTab(c: Ctl): RibbonTab {
  const { sel, act } = c;
  const r = sel.run;
  const p = sel.para;
  const cmd = T.cmd;
  const paste: MenuItem[] = [
    { id: 'h', kind: 'header', label: cmd.pasteOptions },
    { id: 'keep', label: cmd.pasteKeep, icon: 'clipboard_paste', onClick: () => void act.paste('keep') },
    { id: 'text', label: cmd.pasteText, icon: 'text_t', onClick: () => void act.paste('text') },
    { id: 's', kind: 'separator' },
    { id: 'special', label: cmd.pasteSpecial, shortcut: 'Ctrl+Alt+V', onClick: () => c.openDialog('pasteSpecial') },
  ];
  const cases: [CaseMode, string][] = [['sentence', cmd.caseSentence], ['lower', cmd.caseLower], ['upper', cmd.caseUpper], ['title', cmd.caseTitle], ['toggle', cmd.caseToggle]];
  const underlines: [UnderlineType, string][] = [['single', cmd.underline], ['double', cmd.underlineDouble], ['dotted', cmd.underlineDotted], ['wave', cmd.underlineWave]];
  const bulletItems: MenuItem[] = [
    { id: 'h', kind: 'header', label: cmd.bulletLibrary },
    { id: 'none', label: cmd.noList, onClick: () => act.list(null) },
    ...BULLETS.map((ch, i): MenuItem => ({ id: `b${i}`, label: `${ch}`, onClick: () => act.list({ kind: 'bullet', char: ch }) })),
  ];
  const numberItems: MenuItem[] = [
    { id: 'h', kind: 'header', label: cmd.numberLibrary },
    { id: 'none', label: cmd.noList, onClick: () => act.list(null) },
    { id: 'n1', label: '1.  2.  3.', onClick: () => act.list({ kind: 'number', format: 'decimal', text: '%1.' }) },
    { id: 'n2', label: '1)  2)  3)', onClick: () => act.list({ kind: 'number', format: 'decimal', text: '%1)' }) },
    { id: 'n3', label: 'I.  II.  III.', onClick: () => act.list({ kind: 'number', format: 'upperRoman', text: '%1.' }) },
    { id: 'n4', label: 'A.  B.  C.', onClick: () => act.list({ kind: 'number', format: 'upperLetter', text: '%1.' }) },
    { id: 'n5', label: 'a)  b)  c)', onClick: () => act.list({ kind: 'number', format: 'lowerLetter', text: '%1)' }) },
    { id: 'n6', label: 'i.  ii.  iii.', onClick: () => act.list({ kind: 'number', format: 'lowerRoman', text: '%1.' }) },
    { id: 's', kind: 'separator' },
    { id: 'restart', label: cmd.restartNumbering, onClick: () => act.restartNumbering() },
  ];
  const spacing: MenuItem[] = [
    ...[1, 1.15, 1.5, 2, 2.5, 3].map((v): MenuItem => ({
      id: `ls${v}`, label: String(v).replace('.', ','), checked: p.lineSpacing?.rule === 'auto' && Math.abs(p.lineSpacing.value - v) < 0.01,
      onClick: () => c.run(setParagraph({ props: { lineSpacing: { rule: 'auto', value: v } } })),
    })),
    { id: 's', kind: 'separator' },
    { id: 'opts', label: cmd.lineSpacingOptions, onClick: () => c.openDialog('paragraph') },
    { id: 'before', label: cmd.addSpaceBefore, onClick: () => c.run(setParagraph({ props: { spacingBefore: 12 } })) },
    { id: 'after', label: cmd.removeSpaceAfter, onClick: () => c.run(setParagraph({ props: { spacingAfter: 0 } })) },
  ];
  const align = (a: Alignment, label: string, icon: 'text_align_left' | 'text_align_center' | 'text_align_right' | 'text_align_justify', key: string) => ({
    kind: 'toggle' as const, id: `align-${a}`, label, icon, iconOnly: true, pressed: (p.alignment ?? 'left') === a,
    onToggle: () => c.run(setParagraph({ props: { alignment: a } })), tooltip: { title: label, shortcut: `Ctrl+${key}` },
  });
  const borderItems: MenuItem[] = [
    { id: 'bottom', label: T.dialogs.bottom.replace(' (cm)', ''), icon: 'border_bottom', onClick: () => c.run(setParagraph({ props: { borders: { bottom: { style: 'single', width: 0.5, color: 'auto', space: 1 } } } })) },
    { id: 'box', label: cmd.outsideBorders, icon: 'border_outside', onClick: () => {
      const b = { style: 'single' as const, width: 0.5, color: 'auto', space: 1 };
      c.run(setParagraph({ props: { borders: { top: b, bottom: b, left: b, right: b } } }));
    } },
    { id: 'none', label: cmd.noBorders, icon: 'border_none', onClick: () => c.run(setParagraph({ props: { borders: undefined } })) },
    { id: 'dlg', label: X.paraBorders.title + '…', onClick: () => c.openDialog('borders') },
    { id: 'page', label: `${cmd.pageBorders}…`, onClick: () => c.openDialog('pageBorder') },
  ];
  return {
    id: 'home', label: T.tabs.home, keytip: 'L',
    groups: [
      {
        id: 'clipboard', label: T.groups.clipboard, icon: 'clipboard_paste',
        controls: [
          { kind: 'split', id: 'paste', label: cmd.paste, icon: 'clipboard_paste', size: 'large', onClick: () => void act.paste('keep'), items: paste, tooltip: { title: cmd.paste, shortcut: 'Ctrl+V', description: T.tips.paste } },
          { kind: 'button', id: 'cut', label: cmd.cut, icon: 'cut', onClick: act.cut, tooltip: { title: cmd.cut, shortcut: 'Ctrl+X' } },
          { kind: 'button', id: 'copy', label: cmd.copy, icon: 'copy', onClick: act.copy, tooltip: { title: cmd.copy, shortcut: 'Ctrl+C' } },
          { kind: 'button', id: 'painter', label: cmd.painter, icon: 'paint_brush', onClick: () => act.formatPainter(false), tooltip: { title: cmd.painter, shortcut: 'Alt+Ctrl+C', description: T.tips.painter } },
        ],
      },
      {
        id: 'font', label: T.groups.font, icon: 'text_font', launcher: { label: cmd.font, onClick: () => c.openDialog('font') },
        controls: [
          { kind: 'row', id: 'f1', controls: [
            { kind: 'font', id: 'fontname', label: cmd.font, value: r.font ?? '', width: 136, onChange: (font) => c.run(setRunProps({ fontTheme: undefined, font })), tooltip: { title: cmd.font, shortcut: 'Ctrl+Maj+F' } },
            { kind: 'combo', id: 'fontsize', label: cmd.size, value: String(r.size ?? 11), options: FONT_SIZE_OPTIONS, editable: true, width: 52, validate: validateFontSize, onChange: (v) => c.run(setRunProp('size', Number(v))), tooltip: { title: cmd.size, shortcut: 'Ctrl+Maj+P' } },
            { kind: 'button', id: 'grow', label: cmd.grow, icon: 'text_font_size', iconOnly: true, onClick: () => c.run(setRunProp('size', nextFontSize(r.size ?? 11, 1))), tooltip: { title: cmd.grow, shortcut: 'Ctrl+>' } },
            { kind: 'button', id: 'shrink', label: cmd.shrink, icon: 'text_font', iconOnly: true, onClick: () => c.run(setRunProp('size', nextFontSize(r.size ?? 11, -1))), tooltip: { title: cmd.shrink, shortcut: 'Ctrl+<' } },
            { kind: 'menu', id: 'case', label: cmd.changeCase, icon: 'text_change_case', iconOnly: true, items: cases.map(([m, label]) => ({ id: m, label, onClick: () => c.run(changeCase(m)) })) },
            { kind: 'button', id: 'clear', label: cmd.clearFormat, icon: 'text_clear_formatting', iconOnly: true, onClick: () => {
              c.run(clearRunFormatting);
              c.run(setParagraph({ styleId: null, props: () => ({}) }));
            } },
          ] },
          { kind: 'row', id: 'f2', controls: [
            { kind: 'toggle', id: 'bold', label: cmd.bold, icon: 'text_bold', iconOnly: true, pressed: !!r.bold, onToggle: (v) => c.run(setRunProp('bold', v)), tooltip: { title: cmd.bold, shortcut: 'Ctrl+G', description: T.tips.bold } },
            { kind: 'toggle', id: 'italic', label: cmd.italic, icon: 'text_italic', iconOnly: true, pressed: !!r.italic, onToggle: (v) => c.run(setRunProp('italic', v)), tooltip: { title: cmd.italic, shortcut: 'Ctrl+I', description: T.tips.italic } },
            { kind: 'split', id: 'underline', label: cmd.underline, icon: 'text_underline', iconOnly: true, onClick: () => c.run(setRunProp('underline', r.underline && r.underline !== 'none' ? undefined : 'single')), items: underlines.map(([u, label]) => ({ id: u, label, checked: r.underline === u, onClick: () => c.run(setRunProp('underline', u)) })), tooltip: { title: cmd.underline, shortcut: 'Ctrl+U', description: T.tips.underline } },
            { kind: 'toggle', id: 'strike', label: cmd.strike, icon: 'text_strikethrough', iconOnly: true, pressed: !!r.strike, onToggle: (v) => c.run(setRunProp('strike', v)) },
            { kind: 'toggle', id: 'sub', label: cmd.sub, icon: 'text_subscript', iconOnly: true, pressed: r.vertAlign === 'subscript', onToggle: (v) => c.run(setRunProp('vertAlign', v ? 'subscript' : undefined)), tooltip: { title: cmd.sub, shortcut: 'Ctrl+=' } },
            { kind: 'toggle', id: 'sup', label: cmd.sup, icon: 'text_superscript', iconOnly: true, pressed: r.vertAlign === 'superscript', onToggle: (v) => c.run(setRunProp('vertAlign', v ? 'superscript' : undefined)), tooltip: { title: cmd.sup, shortcut: 'Ctrl+Maj++' } },
            { kind: 'menu', id: 'effects', label: cmd.effects, icon: 'text_effects', iconOnly: true, items: [
              { id: 'shadow', label: cmd.shadow, checked: !!r.shadow, onClick: () => c.run(setRunProp('shadow', !r.shadow || undefined)) },
              { id: 'outline', label: cmd.outlineFx, checked: !!r.outline, onClick: () => c.run(setRunProp('outline', !r.outline || undefined)) },
              { id: 'smallcaps', label: cmd.smallCaps, checked: !!r.smallCaps, shortcut: 'Ctrl+Maj+K', onClick: () => c.run(setRunProp('smallCaps', !r.smallCaps)) },
              { id: 'caps', label: cmd.allCaps, checked: !!r.caps, shortcut: 'Ctrl+Maj+A', onClick: () => c.run(setRunProp('caps', !r.caps)) },
              { id: 'hidden', label: cmd.hidden, checked: !!r.hidden, onClick: () => c.run(setRunProp('hidden', !r.hidden || undefined)) },
            ] },
            { kind: 'color', id: 'highlight', label: cmd.highlight, icon: 'highlight', iconOnly: true, value: r.highlight && r.highlight !== 'none' ? highlightHex(r.highlight) : '#FFFF00', emptyMode: 'none', onChange: (hex) => c.run(setRunProp('highlight', hex ? nearestHighlight(hex) : undefined)) },
            { kind: 'color', id: 'fontcolor', label: cmd.fontColor, icon: 'text_color', iconOnly: true, value: colorHex(r) ?? '#C00000', onChange: (hex) => c.run(setRunProp('color', hex ? { rgb: hex.replace('#', '').toUpperCase() } : undefined)) },
          ] },
        ],
      },
      {
        id: 'paragraph', label: T.groups.paragraph, icon: 'text_paragraph', launcher: { label: cmd.lineSpacingOptions, onClick: () => c.openDialog('paragraph') },
        controls: [
          { kind: 'row', id: 'p1', controls: [
            { kind: 'split', id: 'bullets', label: cmd.bullets, icon: 'text_bullet_list_ltr', iconOnly: true, onClick: () => act.list(p.numbering ? null : { kind: 'bullet', char: BULLETS[0] }), items: bulletItems },
            { kind: 'split', id: 'numbering', label: cmd.numbering, icon: 'text_number_list_ltr', iconOnly: true, onClick: () => act.list(p.numbering ? null : { kind: 'number', format: 'decimal', text: '%1.' }), items: numberItems },
            { kind: 'split', id: 'multilevel', label: cmd.multilevel, icon: 'text_bullet_list_tree', iconOnly: true, onClick: () => act.list({ kind: 'multilevel' }), items: [
              { id: 'standard', label: cmd.multilevel, onClick: () => act.list({ kind: 'multilevel' }) },
              { id: 'define', label: X.listDefine.menu, onClick: () => c.openDialog('listDefine') },
            ] },
            { kind: 'button', id: 'outdent', label: cmd.outdent, icon: 'text_indent_decrease_ltr', iconOnly: true, onClick: () => c.run(indent(-1)), tooltip: { title: cmd.outdent, shortcut: 'Ctrl+Maj+M' } },
            { kind: 'button', id: 'indent', label: cmd.indent, icon: 'text_indent_increase_ltr', iconOnly: true, onClick: () => c.run(indent(1)), tooltip: { title: cmd.indent, shortcut: 'Ctrl+M' } },
            { kind: 'button', id: 'sort', label: cmd.sort, icon: 'text_sort_ascending', iconOnly: true, onClick: () => c.openDialog('sort') },
            { kind: 'toggle', id: 'marks', label: cmd.showMarks, icon: 'text_paragraph', iconOnly: true, pressed: c.ui.showMarks, onToggle: (v) => c.setUi({ showMarks: v }), tooltip: { title: cmd.showMarks, shortcut: 'Ctrl+*', description: T.tips.showMarks } },
          ] },
          { kind: 'row', id: 'p2', controls: [
            align('left', cmd.alignLeft, 'text_align_left', 'L'),
            align('center', cmd.center, 'text_align_center', 'E'),
            align('right', cmd.alignRight, 'text_align_right', 'R'),
            align('justify', cmd.justify, 'text_align_justify', 'J'),
            { kind: 'menu', id: 'spacing', label: cmd.lineSpacing, icon: 'text_line_spacing', iconOnly: true, items: spacing },
            { kind: 'color', id: 'shading', label: cmd.shading, icon: 'paint_bucket', iconOnly: true, value: p.shading?.fill && p.shading.fill !== 'auto' ? `#${p.shading.fill}` : '#FFFF00', emptyMode: 'none', onChange: (hex) => c.run(setParagraph({ props: { shading: hex ? { fill: hex.slice(1).toUpperCase(), pattern: 'clear' } : undefined } })) },
            { kind: 'menu', id: 'borders', label: cmd.borders, icon: 'border_bottom', iconOnly: true, items: borderItems },
          ] },
        ],
      },
      {
        id: 'styles', label: T.groups.styles, icon: 'text_font', launcher: { label: cmd.stylesPane, onClick: () => c.setUi({ pane: c.ui.pane === 'styles' ? null : 'styles' }) },
        controls: [
          {
            kind: 'gallery', id: 'styles', label: T.styles.gallery, items: styleGallery(c.meta), selectedId: sel.charStyle ?? sel.styleId, itemWidth: 84, columns: 5,
            onSelect: (id) => act.applyStyle(id), onPreview: (id) => act.setPreviewStyle(id), onPreviewEnd: () => act.setPreviewStyle(null),
            tooltip: { title: T.groups.styles, description: T.tips.styles },
            footer: [
              { id: 'create', label: cmd.createStyle, icon: 'add', onClick: () => c.openDialog('style') },
              { id: 'clear', label: cmd.clearStyle, icon: 'text_clear_formatting', onClick: () => act.applyStyle('Normal') },
              { id: 'pane', label: cmd.stylesPane, onClick: () => c.setUi({ pane: 'styles' }) },
            ],
          },
        ],
      },
      {
        id: 'editing', label: T.groups.editing, icon: 'search',
        controls: [
          { kind: 'button', id: 'find', label: cmd.find, icon: 'search', onClick: () => c.setUi({ nav: true }), tooltip: { title: cmd.find, shortcut: 'Ctrl+F', description: T.tips.find } },
          { kind: 'button', id: 'replace', label: cmd.replace, icon: 'arrow_sync', onClick: () => c.openDialog('find'), tooltip: { title: cmd.replace, shortcut: 'Ctrl+H', description: T.tips.replace } },
          { kind: 'menu', id: 'select', label: cmd.select, icon: 'select_all_on', items: [
            { id: 'all', label: cmd.selectAll, shortcut: 'Ctrl+A', onClick: () => c.run((s, d) => {
              if (d) d(s.tr.setSelection(new AllSelection(s.doc)));
              return true;
            }) },
            { id: 'goto', label: cmd.goTo, shortcut: 'F5', onClick: () => c.openDialog('goto') },
          ] },
        ],
      },
    ],
  };
}

