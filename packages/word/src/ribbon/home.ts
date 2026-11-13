// Onglet Accueil : presse-papiers, police, paragraphe, styles, modification.
import { AllSelection } from 'prosemirror-state';
import { FONT_SIZE_OPTIONS, isOnlyOffice, nextFontSize, validateFontSize, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
import type { ReactNode } from 'react';
import type { Alignment, NumberFormat, NumberingLevel, UnderlineType } from '@forgeoffice/docx';
import type { ListSpec } from '../features/lists.ts';
import { listTile, noneTile } from './listTiles.tsx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { BULLETS, changeCase, clearRunFormatting, indent, setParagraph, setRunProp, setRunProps, type CaseMode } from '../editor/commands.ts';
import { nearestHighlight, highlightHex } from '../editor/css.ts';
import { colorHex, styleGallery } from './shared.ts';

const ooBullets0 = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';

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
  const cases: [CaseMode, string][] = ooBullets0()
    ? [['sentence', 'Majuscule en début de phrase.'], ['lower', 'minuscule'], ['upper', 'Majuscules'], ['title', 'Mettre en majuscule chaque mot'], ['toggle', 'Inverser la casse']]
    : [['sentence', cmd.caseSentence], ['lower', cmd.caseLower], ['upper', cmd.caseUpper], ['title', cmd.caseTitle], ['toggle', cmd.caseToggle]];
  const underlines: [UnderlineType, string][] = [['single', cmd.underline], ['double', cmd.underlineDouble], ['dotted', cmd.underlineDotted], ['wave', cmd.underlineWave]];
  const ooBullets = typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';
  // Profil OnlyOffice : « Bibliotheque de puces » = grille de cases blanches (Aucun + puces), puis les entrees de liste (grisees : pas de fonction).
  const bulletItems: MenuItem[] = [
    { id: 'h', kind: 'header', label: cmd.bulletLibrary },
    { id: 'none', label: cmd.noList, cell: ooBullets, onClick: () => act.list(null) },
    ...BULLETS.map((ch, i): MenuItem => ({ id: `b${i}`, label: `${ch}`, cell: ooBullets, onClick: () => act.list({ kind: 'bullet', char: ch }) })),
    ...(ooBullets ? [{ id: 's', kind: 'separator' as const }, { id: 'level', label: 'Changer le niveau de liste', disabled: true }, { id: 'lsettings', label: 'Paramètres de la liste', disabled: true }] : []),
  ];
  const numberItemsDefault: MenuItem[] = [
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
  const tileItem = (id: string, label: string, tile: ReactNode, spec: ListSpec | null | undefined): MenuItem => (
    { id, label, tile: true, adornment: tile, disabled: spec === undefined, tooltip: spec === undefined ? 'Pas encore disponible dans ForgeOffice' : undefined, onClick: spec === undefined ? undefined : () => act.list(spec) }
  );
  const lv = (format: NumberFormat, text: string, i: number): NumberingLevel => ({ level: i, format, text, start: 1, alignment: 'left', suffix: 'tab', paragraph: { indentLeft: 36 + i * 36, indentFirstLine: -18 } });
  const bulletLv = (ch: string, i: number): NumberingLevel => ({ ...lv('bullet', ch, i), run: { font: 'Segoe UI Symbol' } });
  const ooLevels = (a: NumberingLevel[]): ListSpec => ({ kind: 'custom', levels: Array.from({ length: 9 }, (_, i) => ({ ...a[Math.min(i, a.length - 1)]!, level: i, paragraph: { indentLeft: 36 + i * 36, indentFirstLine: -18 } })) });
  const ooTail: MenuItem[] = [{ id: 's', kind: 'separator' }, { id: 'level', label: 'Changer le niveau de liste', disabled: true }, { id: 'lsettings', label: 'Paramètres de la liste', onClick: () => c.openDialog('listDefine') }];
  const numberItemsOO: MenuItem[] = [
    { id: 'h', kind: 'header', label: 'Bibliothèque de numérotations' },
    tileItem('none', cmd.noList, noneTile, null),
    tileItem('n4', 'A. B. C.', listTile(['A.', 'B.', 'C.']), { kind: 'number', format: 'upperLetter', text: '%1.' }),
    tileItem('n5', 'a) b) c)', listTile(['a)', 'b)', 'c)']), { kind: 'number', format: 'lowerLetter', text: '%1)' }),
    tileItem('n7', 'a. b. c.', listTile(['a.', 'b.', 'c.']), { kind: 'number', format: 'lowerLetter', text: '%1.' }),
    tileItem('n1', '1. 2. 3.', listTile(['1.', '2.', '3.']), { kind: 'number', format: 'decimal', text: '%1.' }),
    tileItem('n2', '1) 2) 3)', listTile(['1)', '2)', '3)']), { kind: 'number', format: 'decimal', text: '%1)' }),
    tileItem('n3', 'I. II. III.', listTile(['I.', 'II.', 'III.']), { kind: 'number', format: 'upperRoman', text: '%1.' }),
    tileItem('n6', 'i. ii. iii.', listTile(['i.', 'ii.', 'iii.']), { kind: 'number', format: 'lowerRoman', text: '%1.' }),
    { id: 'restart', label: cmd.restartNumbering, onClick: () => act.restartNumbering() },
    ...ooTail,
  ];
  const multiItemsOO: MenuItem[] = [
    { id: 'h', kind: 'header', label: 'Bibliothèque de listes' },
    tileItem('none', cmd.noList, noneTile, null),
    tileItem('m1', '1) a) i)', listTile(['1)', 'a)', 'i)'], true), ooLevels([lv('decimal', '%1)', 0), lv('lowerLetter', '%2)', 1), lv('lowerRoman', '%3)', 2)])),
    tileItem('m2', '1. 1.1. 1.1.1.', listTile(['1.', '1.1.', '1.1.1.'], true), { kind: 'multilevel' }),
    tileItem('m3', '❖ ➤ ▪', listTile(['❖', '➤', '▪'], true), ooLevels([bulletLv('❖', 0), bulletLv('➤', 1), bulletLv('▪', 2)])),
    tileItem('m4', 'I. A. 1. (titres)', listTile(['I.', 'A.', '1.'], true), undefined),
    tileItem('m5', '1. 1.1. 1.1.1. (titres)', listTile(['1.', '1.1.', '1.1.1.'], true), undefined),
    tileItem('m6', 'Article I. Section 1.01 (a)', listTile(['Article I.', 'Section 1.', '(a)'], true), undefined),
    tileItem('m7', 'Chapitre 1 (titres)', listTile(['Chapitre 1', 'Titre 2', 'Titre 3'], true), undefined),
    ...ooTail,
  ];
  const numberItems = ooBullets ? numberItemsOO : numberItemsDefault;
  // Profil OnlyOffice : « 1.0, 1.15... » (point decimal), « Options d'interligne », ajout d'espace avant et apres (menu d'OnlyOffice 10.0) ; nos entrees restent.
  const oo = typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';
  const spacing: MenuItem[] = [
    ...[1, 1.15, 1.5, 2, 2.5, 3].map((v): MenuItem => ({
      id: `ls${v}`, label: oo ? v.toFixed(v === 1.15 ? 2 : 1) : String(v).replace('.', ','), checked: p.lineSpacing?.rule === 'auto' && Math.abs(p.lineSpacing.value - v) < 0.01,
      onClick: () => c.run(setParagraph({ props: { lineSpacing: { rule: 'auto', value: v } } })),
    })),
    ...(oo ? [] : [{ id: 's', kind: 'separator' as const }]),
    { id: 'opts', label: oo ? cmd.lineSpacingOptions.replace(/…$/, '') : cmd.lineSpacingOptions, onClick: () => c.openDialog('paragraph') },
    ...(oo ? [{ id: 's', kind: 'separator' as const }] : []),
    { id: 'before', label: cmd.addSpaceBefore, onClick: () => c.run(setParagraph({ props: { spacingBefore: 12 } })) },
    ...(oo ? [{ id: 'addafter', label: 'Ajouter un espace après le paragraphe', onClick: () => c.run(setParagraph({ props: { spacingAfter: 10 } })) }] : []),
    { id: 'after', label: cmd.removeSpaceAfter, onClick: () => c.run(setParagraph({ props: { spacingAfter: 0 } })) },
  ];
  const align = (a: Alignment, label: string, icon: 'text_align_left' | 'text_align_center' | 'text_align_right' | 'text_align_justify', key: string) => ({
    kind: 'toggle' as const, id: `align-${a}`, label, icon, iconOnly: true, pressed: (p.alignment ?? 'left') === a,
    onToggle: () => c.run(setParagraph({ props: { alignment: a } })), tooltip: { title: label, shortcut: `Ctrl+${key}` },
  });
  const borderItemsDefault: MenuItem[] = [
    { id: 'bottom', label: T.dialogs.bottom.replace(' (cm)', ''), icon: 'border_bottom', onClick: () => c.run(setParagraph({ props: { borders: { bottom: { style: 'single', width: 0.5, color: 'auto', space: 1 } } } })) },
    { id: 'box', label: cmd.outsideBorders, icon: 'border_outside', onClick: () => {
      const b = { style: 'single' as const, width: 0.5, color: 'auto', space: 1 };
      c.run(setParagraph({ props: { borders: { top: b, bottom: b, left: b, right: b } } }));
    } },
    { id: 'none', label: cmd.noBorders, icon: 'border_none', onClick: () => c.run(setParagraph({ props: { borders: undefined } })) },
    { id: 'dlg', label: X.paraBorders.title + '…', onClick: () => c.openDialog('borders') },
    { id: 'page', label: `${cmd.pageBorders}…`, onClick: () => c.openDialog('pageBorder') },
  ];
  // Profil OnlyOffice : meme liste que « Bordures » de l'application (haut/bas/gauche/droite, aucune, toutes, exterieures, interieures).
  const line = { style: 'single' as const, width: 0.5, color: 'auto', space: 1 };
  const side = (id: string, label: string, icon: MenuItem['icon'], key: 'top' | 'bottom' | 'left' | 'right'): MenuItem => ({ id, label, icon, onClick: () => c.run(setParagraph({ props: { borders: { ...p.borders, [key]: line } } })) });
  const outside = (): void => { c.run(setParagraph({ props: { borders: { top: line, bottom: line, left: line, right: line } } })); };
  const borderItemsOO: MenuItem[] = [
    side('bottom', 'Bordures inférieures', 'border_bottom', 'bottom'),
    side('top', 'Bordures supérieures', 'border_top', 'top'),
    side('left', 'Bordures gauches', 'border_left', 'left'),
    side('right', 'Bordures droites', 'border_right', 'right'),
    { id: 's1', kind: 'separator' },
    { id: 'none', label: 'Aucune bordure', icon: 'border_none', onClick: () => c.run(setParagraph({ props: { borders: undefined } })) },
    { id: 'all', label: 'Toutes les bordures', icon: 'border_all', onClick: outside },
    { id: 'box', label: 'Bordures extérieures', icon: 'border_outside', onClick: outside },
    { id: 'inside', label: 'Bordures intérieures', icon: 'border_inside', disabled: true, tooltip: 'Pas encore disponible dans ForgeOffice' },
    { id: 'inh', label: 'Bordures horizontales internes', icon: 'border_top_bottom', disabled: true, tooltip: 'Pas encore disponible dans ForgeOffice' },
    { id: 's2', kind: 'separator' },
    { id: 'dlg', label: X.paraBorders.title + '…', onClick: () => c.openDialog('borders') },
    { id: 'page', label: `${cmd.pageBorders}…`, onClick: () => c.openDialog('pageBorder') },
  ];
  const borderItems = ooBullets ? borderItemsOO : borderItemsDefault;
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
            { kind: 'color', id: 'highlight', palette: 'highlight', label: cmd.highlight, icon: 'highlight', iconOnly: true, value: r.highlight && r.highlight !== 'none' ? highlightHex(r.highlight) : '#FFFF00', emptyMode: 'none', onChange: (hex) => c.run(setRunProp('highlight', hex ? nearestHighlight(hex) : undefined)) },
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
            { kind: 'split', id: 'multilevel', label: cmd.multilevel, icon: 'text_bullet_list_tree', iconOnly: true, onClick: () => act.list({ kind: 'multilevel' }), items: ooBullets ? multiItemsOO : [
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
            kind: 'gallery', id: 'styles', label: T.styles.gallery, items: styleGallery(c.meta), selectedId: sel.charStyle ?? sel.styleId, itemWidth: isOnlyOffice() ? 108 : 84, columns: 5,
            onSelect: (id) => act.applyStyle(id), onPreview: (id) => act.setPreviewStyle(id), onPreviewEnd: () => act.setPreviewStyle(null),
            tooltip: { title: T.groups.styles, description: T.tips.styles },
            footer: isOnlyOffice() ? [{ id: 'create', label: 'Nouveau style à partir du fragment sélectionné', icon: 'add', onClick: () => c.openDialog('style') }] : [
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
          { kind: 'button', id: 'find', label: cmd.find, icon: 'search', onClick: () => (isOnlyOffice() ? c.openDialog('find') : c.setUi({ nav: true })), tooltip: { title: cmd.find, shortcut: 'Ctrl+F', description: T.tips.find } },
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

