// Onglet Accueil : Presse-papiers, Diapositives, Police, Paragraphe, Dessin, Modification.
import { FONT_SIZE_OPTIONS, nextFontSize, validateFontSize, type MenuItem, type RibbonControl, type RibbonTab } from '@forgeoffice/ui';
import type { Bullet, ParagraphProps } from '@forgeoffice/pptx';
import { applyBody, applyCase, applyParagraph, applyRun, colorFromHex, currentBody, currentParagraph, currentRun, hexOf, setFill, setLine } from '../format.ts';
import { themeSwatches } from '../themes.ts';
import { applyQuickStyle, arrangeItems, quickStyleItems, shapeItems, SlidesGroup } from './galleries.tsx';
import type { TabContext } from './common.tsx';
import { effectsMenu, outlineMenu } from './shape-menus.tsx';
import { S } from '../../strings.ts';

const BULLETS: ReadonlyArray<{ id: string; char: string; font?: string }> = [
  { id: 'dot', char: '•', font: 'Arial' },
  { id: 'circle', char: 'o', font: 'Courier New' },
  { id: 'square', char: '§', font: 'Wingdings' },
  { id: 'diamond', char: 'v', font: 'Wingdings' },
  { id: 'arrow', char: 'Ø', font: 'Wingdings' },
  { id: 'check', char: 'ü', font: 'Wingdings' },
];

const NUMBERS = ['arabicPeriod', 'arabicParenR', 'romanUcPeriod', 'alphaUcPeriod', 'alphaLcParenR', 'alphaLcPeriod', 'romanLcPeriod'] as const;

export function homeTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const run = currentRun(ed);
  const para = currentParagraph(ed);
  const body = currentBody(ed);
  const hasShape = ed.selection.ids.length > 0 || !!ed.selection.text;
  const themeColors = themeSwatches(ed.ctx.theme.colors);
  const font = run.font ?? ed.ctx.theme.fonts.minor.latin;
  const size = run.size ?? 18;
  const bullet = para.bullet;

  const setBullet = (b: Bullet | null, extra: Partial<ParagraphProps> = {}): void =>
    applyParagraph(ed, (props) => {
      const out: ParagraphProps = { ...props, ...extra };
      if (b) out.bullet = b;
      else out.bullet = { type: 'none' };
      if (b && out.marginLeft === undefined && b.type !== 'none') {
        out.marginLeft = 22.5 + (props.level ?? 0) * 22.5;
        out.indent = -22.5;
      }
      if (!b) {
        out.indent = 0;
        out.marginLeft = (props.level ?? 0) * 22.5;
      }
      return out;
    }, 'bullets');

  const bulletItems: MenuItem[] = [
    { id: 'none', label: S.home.none, checked: !bullet || bullet.type === 'none', onClick: () => setBullet(null) },
    ...BULLETS.map((b) => ({ id: b.id, label: S.home.bulletNames[b.id as keyof typeof S.home.bulletNames], checked: bullet?.type === 'char' && bullet.char === b.char, onClick: () => setBullet({ type: 'char', char: b.char }, { bulletFont: b.font }) })),
  ];
  const numberItems: MenuItem[] = [
    { id: 'none', label: S.home.none, onClick: () => setBullet(null) },
    ...NUMBERS.map((scheme) => ({ id: scheme, label: S.home.numberNames[scheme], checked: bullet?.type === 'auto' && bullet.scheme === scheme, onClick: () => setBullet({ type: 'auto', scheme }) })),
  ];
  const spacingItems: MenuItem[] = [1, 1.15, 1.5, 2, 2.5, 3].map((v) => ({
    id: String(v),
    label: String(v).replace('.', ','),
    checked: para.lineSpacing?.type === 'pct' && Math.abs(para.lineSpacing.value - v * 100) < 1,
    onClick: () => applyParagraph(ed, { lineSpacing: { type: 'pct', value: v * 100 } }),
  }));
  const anchorItems: MenuItem[] = [
    { id: 't', label: S.home.anchorTop, icon: 'align_top', checked: (body.anchor ?? 't') === 't', onClick: () => applyBody(ed, { anchor: 't' }) },
    { id: 'ctr', label: S.home.anchorMiddle, checked: body.anchor === 'ctr', onClick: () => applyBody(ed, { anchor: 'ctr' }) },
    { id: 'b', label: S.home.anchorBottom, icon: 'align_bottom', checked: body.anchor === 'b', onClick: () => applyBody(ed, { anchor: 'b' }) },
  ];
  const directionItems: MenuItem[] = [
    { id: 'horz', label: S.home.dirHorizontal, checked: !body.vertical || body.vertical === 'horz', onClick: () => applyBody(ed, { vertical: 'horz' }) },
    { id: 'vert', label: S.home.dirRotate90, checked: body.vertical === 'vert', onClick: () => applyBody(ed, { vertical: 'vert' }) },
    { id: 'vert270', label: S.home.dirRotate270, checked: body.vertical === 'vert270', onClick: () => applyBody(ed, { vertical: 'vert270' }) },
    { id: 'eaVert', label: S.home.dirStacked, checked: body.vertical === 'eaVert', onClick: () => applyBody(ed, { vertical: 'eaVert' }) },
  ];
  const columnItems: MenuItem[] = [1, 2, 3].map((n) => ({ id: String(n), label: S.home.columnsN(n), checked: (body.columns ?? 1) === n, onClick: () => applyBody(ed, { columns: n, columnSpacing: n > 1 ? 18 : undefined }) }));
  const caseItems: MenuItem[] = [
    { id: 'sentence', label: S.home.caseSentence, onClick: () => applyCase(ed, 'sentence') },
    { id: 'lower', label: S.home.caseLower, onClick: () => applyCase(ed, 'lower') },
    { id: 'upper', label: S.home.caseUpper, onClick: () => applyCase(ed, 'upper') },
    { id: 'title', label: S.home.caseTitle, onClick: () => applyCase(ed, 'title') },
    { id: 'toggle', label: S.home.caseToggle, onClick: () => applyCase(ed, 'toggle') },
  ];
  const spacingCharItems: MenuItem[] = [
    { id: 'vt', label: S.home.charVeryTight, onClick: () => applyRun(ed, { spacing: -3 }) },
    { id: 't', label: S.home.charTight, onClick: () => applyRun(ed, { spacing: -1.5 }) },
    { id: 'n', label: S.home.charNormal, onClick: () => applyRun(ed, { spacing: null }) },
    { id: 'l', label: S.home.charLoose, onClick: () => applyRun(ed, { spacing: 3 }) },
    { id: 'vl', label: S.home.charVeryLoose, onClick: () => applyRun(ed, { spacing: 6 }) },
  ];
  const slideIds = new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
  const fontControls: RibbonControl[] = [
    { kind: 'row', id: 'fontTop', controls: [
    { kind: 'font', id: 'font', label: S.home.font, value: font, width: 150, disabled: !hasShape, onChange: (f) => applyRun(ed, { font: f }) },
    { kind: 'combo', id: 'size', label: S.home.size, value: String(Math.round(size * 10) / 10), options: FONT_SIZE_OPTIONS, editable: true, width: 56, validate: validateFontSize, disabled: !hasShape, onChange: (v) => applyRun(ed, { size: Number(v) }) },
    { kind: 'button', id: 'grow', label: S.home.grow, icon: 'text_font_size', iconOnly: true, tooltip: { title: S.home.grow, shortcut: 'Ctrl+Maj+>' }, disabled: !hasShape, onClick: () => applyRun(ed, { size: nextFontSize(size, 1) }) },
    { kind: 'button', id: 'shrink', label: S.home.shrink, icon: 'text_font_size', iconOnly: true, tooltip: { title: S.home.shrink, shortcut: 'Ctrl+Maj+<' }, disabled: !hasShape, onClick: () => applyRun(ed, { size: nextFontSize(size, -1) }) },
    { kind: 'button', id: 'clear', label: S.home.clear, icon: 'text_clear_formatting', iconOnly: true, disabled: !hasShape, onClick: () => applyRun(ed, { bold: null, italic: null, underline: null, strike: null, color: null, size: null, font: null, highlight: null, spacing: null, caps: null, baseline: null, effects: null, textFill: null, outline: null }) },
    ] },
    {
      kind: 'row', id: 'fontRow', controls: [
        { kind: 'toggle', id: 'bold', label: S.home.bold, icon: 'text_bold', pressed: !!run.bold, tooltip: { title: S.home.bold, shortcut: 'Ctrl+G' }, disabled: !hasShape, onToggle: (p) => applyRun(ed, { bold: p || null }) },
        { kind: 'toggle', id: 'italic', label: S.home.italic, icon: 'text_italic', pressed: !!run.italic, tooltip: { title: S.home.italic, shortcut: 'Ctrl+I' }, disabled: !hasShape, onToggle: (p) => applyRun(ed, { italic: p || null }) },
        { kind: 'toggle', id: 'underline', label: S.home.underline, icon: 'text_underline', pressed: !!run.underline && run.underline !== 'none', tooltip: { title: S.home.underline, shortcut: 'Ctrl+U' }, disabled: !hasShape, onToggle: (p) => applyRun(ed, { underline: p ? 'sng' : null }) },
        { kind: 'toggle', id: 'strike', label: S.home.strike, icon: 'text_strikethrough', pressed: !!run.strike && run.strike !== 'noStrike', disabled: !hasShape, onToggle: (p) => applyRun(ed, { strike: p ? 'sngStrike' : null }) },
        { kind: 'toggle', id: 'shadow', label: S.home.shadow, icon: 'text_effects', pressed: !!run.effects?.outerShadow, disabled: !hasShape, onToggle: (p) => applyRun(ed, { effects: p ? { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 43000 }] }, blur: 3, distance: 1.5, direction: 45 } } : null }) },
        { kind: 'menu', id: 'charSpacing', label: S.home.charSpacing, icon: 'text_column_one', iconOnly: true, disabled: !hasShape, items: spacingCharItems },
        { kind: 'menu', id: 'case', label: S.home.changeCase, icon: 'text_change_case', iconOnly: true, disabled: !hasShape, items: caseItems },
        { kind: 'toggle', id: 'sup', label: S.home.superscript, icon: 'text_superscript', pressed: (run.baseline ?? 0) > 0, disabled: !hasShape, onToggle: (p) => applyRun(ed, { baseline: p ? 30 : null }) },
        { kind: 'toggle', id: 'sub', label: S.home.subscript, icon: 'text_subscript', pressed: (run.baseline ?? 0) < 0, disabled: !hasShape, onToggle: (p) => applyRun(ed, { baseline: p ? -25 : null }) },
        { kind: 'color', id: 'highlight', label: S.home.highlight, icon: 'highlight', value: run.highlight ? hexOf(ed, run.highlight) : '#FFFF00', emptyMode: 'none', disabled: !hasShape, onChange: (c) => applyRun(ed, { highlight: c ? colorFromHex(ed, c) : null }) },
        { kind: 'color', id: 'color', label: S.home.color, icon: 'text_color', value: run.color ? hexOf(ed, run.color) : '#C00000', themeColors, disabled: !hasShape, onChange: (c) => applyRun(ed, { color: c ? colorFromHex(ed, c) : null }) },
      ],
    },
  ];

  return {
    id: 'home',
    label: S.tabs.home,
    keytip: 'L',
    groups: [
      {
        id: 'clipboard', label: S.home.clipboard, icon: 'clipboard_paste',
        controls: [
          {
            kind: 'split', id: 'paste', label: S.common.paste, icon: 'clipboard_paste', size: 'large', tooltip: { title: S.common.paste, shortcut: 'Ctrl+V' }, onClick: () => app.paste(),
            items: [
              { id: 'h', kind: 'header', label: S.home.pasteOptions },
              { id: 'keep', label: S.home.pasteKeep, icon: 'clipboard_paste', onClick: () => app.paste('keep') },
              { id: 'pic', label: S.home.pastePicture, icon: 'image', onClick: () => app.paste('picture') },
              { id: 'text', label: S.home.pasteText, icon: 'text_t', onClick: () => app.paste('text') },
            ],
          },
          { kind: 'button', id: 'cut', label: S.common.cut, icon: 'cut', size: 'small', tooltip: { title: S.common.cut, shortcut: 'Ctrl+X' }, onClick: app.cut },
          { kind: 'button', id: 'copy', label: S.common.copy, icon: 'copy', size: 'small', tooltip: { title: S.common.copy, shortcut: 'Ctrl+C' }, onClick: app.copy },
          { kind: 'toggle', id: 'painter', label: S.home.painter, icon: 'paint_brush', size: 'small', pressed: app.painterActive, tooltip: { title: S.home.painter, description: S.home.painterTip, shortcut: 'Ctrl+Maj+C' }, onToggle: app.copyFormat },
        ],
      },
      { id: 'slides', label: S.home.slides, icon: 'slide_add', controls: [{ kind: 'custom', id: 'slidesGroup', label: S.slides.newSlide, render: () => <SlidesGroup ctx={ctx} /> }] },
      { id: 'font', label: S.home.fontGroup, icon: 'text_font', launcher: { label: S.home.fontDialog, onClick: () => app.pane('format') }, controls: fontControls },
      {
        id: 'paragraph', label: S.home.paragraph, icon: 'text_paragraph',
        controls: [
          {
            kind: 'row', id: 'listRow', controls: [
              { kind: 'split', id: 'bullets', label: S.home.bullets, icon: 'text_bullet_list_ltr', iconOnly: true, disabled: !hasShape, onClick: () => setBullet(bullet?.type === 'char' ? null : { type: 'char', char: '•' }, { bulletFont: 'Arial' }), items: bulletItems },
              { kind: 'split', id: 'numbering', label: S.home.numbering, icon: 'text_number_list_ltr', iconOnly: true, disabled: !hasShape, onClick: () => setBullet(bullet?.type === 'auto' ? null : { type: 'auto', scheme: 'arabicPeriod' }), items: numberItems },
              { kind: 'button', id: 'outdent', label: S.home.outdent, icon: 'text_indent_decrease_ltr', iconOnly: true, disabled: !hasShape, onClick: () => applyParagraph(ed, (p) => ({ ...p, level: Math.max(0, (p.level ?? 0) - 1) })) },
              { kind: 'button', id: 'indent', label: S.home.indent, icon: 'text_indent_increase_ltr', iconOnly: true, disabled: !hasShape, onClick: () => applyParagraph(ed, (p) => ({ ...p, level: Math.min(8, (p.level ?? 0) + 1) })) },
              { kind: 'menu', id: 'lineSpacing', label: S.home.lineSpacing, icon: 'text_line_spacing', iconOnly: true, disabled: !hasShape, items: spacingItems },
            ],
          },
          {
            kind: 'row', id: 'alignRow', controls: [
              { kind: 'toggle', id: 'alignLeft', label: S.home.alignLeft, icon: 'text_align_left', pressed: (para.align ?? 'l') === 'l', tooltip: { title: S.home.alignLeft, shortcut: 'Ctrl+Maj+G' }, disabled: !hasShape, onToggle: () => applyParagraph(ed, { align: 'l' }) },
              { kind: 'toggle', id: 'alignCenter', label: S.home.alignCenter, icon: 'text_align_center', pressed: para.align === 'ctr', tooltip: { title: S.home.alignCenter, shortcut: 'Ctrl+E' }, disabled: !hasShape, onToggle: () => applyParagraph(ed, { align: 'ctr' }) },
              { kind: 'toggle', id: 'alignRight', label: S.home.alignRight, icon: 'text_align_right', pressed: para.align === 'r', tooltip: { title: S.home.alignRight, shortcut: 'Ctrl+Maj+D' }, disabled: !hasShape, onToggle: () => applyParagraph(ed, { align: 'r' }) },
              { kind: 'toggle', id: 'justify', label: S.home.justify, icon: 'text_align_justify', pressed: para.align === 'just', tooltip: { title: S.home.justify, shortcut: 'Ctrl+J' }, disabled: !hasShape, onToggle: () => applyParagraph(ed, { align: 'just' }) },
              { kind: 'menu', id: 'columns', label: S.home.columns, icon: 'text_column_two_left', iconOnly: true, disabled: !hasShape, items: columnItems },
              { kind: 'menu', id: 'direction', label: S.home.direction, icon: 'text_direction_vertical', iconOnly: true, disabled: !hasShape, items: directionItems },
              { kind: 'menu', id: 'anchor', label: S.home.anchor, icon: 'textbox_align_center', iconOnly: true, disabled: !hasShape, items: anchorItems },
            ],
          },
        ],
      },
      {
        id: 'drawing', label: S.home.drawing, icon: 'shapes', launcher: { label: S.home.formatShape, onClick: () => app.pane('format') },
        controls: [
          { kind: 'gallery', id: 'shapes', label: S.insert.shapes, items: shapeItems(), itemWidth: 24, columns: 12, onSelect: (id) => app.drawShape(id) },
          { kind: 'menu', id: 'arrange', label: S.arrange.title, icon: 'position_forward', size: 'large', items: arrangeItems(ctx) },
          { kind: 'gallery', id: 'quick', label: S.drawing.quickStyles, items: quickStyleItems(ed), itemWidth: 48, columns: 7, disabled: !ed.selection.ids.length, onSelect: (id) => applyQuickStyle(ed, id) },
          { kind: 'color', id: 'fill', label: S.drawing.fill, icon: 'paint_bucket', size: 'small', value: '#156082', emptyMode: 'none', themeColors, disabled: !ed.selection.ids.length, onChange: (c) => setFill(ed, c ? { type: 'solid', color: colorFromHex(ed, c) } : { type: 'none' }) },
          { kind: 'menu', id: 'outline', label: S.drawing.outline, icon: 'color_line', size: 'small', disabled: !ed.selection.ids.length, items: outlineMenu(ed) },
          { kind: 'menu', id: 'effects', label: S.drawing.effects, icon: 'sparkle', size: 'small', disabled: !ed.selection.ids.length, items: effectsMenu(ed) },
        ],
      },
      {
        id: 'editing', label: S.home.editing, icon: 'search',
        controls: [
          { kind: 'button', id: 'find', label: S.home.find, icon: 'search', size: 'small', tooltip: { title: S.home.find, shortcut: 'Ctrl+F' }, onClick: () => app.dialog('find') },
          { kind: 'button', id: 'replace', label: S.home.replace, icon: 'arrow_sync', size: 'small', tooltip: { title: S.home.replace, shortcut: 'Ctrl+H' }, onClick: () => app.dialog('replace') },
          {
            kind: 'menu', id: 'select', label: S.home.select, icon: 'select_all_on', size: 'small',
            items: [
              { id: 'all', label: S.home.selectAll, shortcut: 'Ctrl+A', onClick: () => ed.setSelection({ ids: ed.pageShapes.map((s) => s.id) }) },
              { id: 'pane', label: S.arrange.selectionPane, icon: 'layer', onClick: () => app.pane('selection') },
            ],
          },
        ],
      },
    ],
  };
}
