// Onglet Accueil : presse-papiers, police, alignement, nombre, styles, cellules, edition.
import { FONT_SIZE_OPTIONS, validateFontSize, type GalleryItem, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
import { resolveColor, type IconSetName } from '@forgeoffice/xlsx';
import { CELL_STYLE_PRESETS, numFmtOf, type BorderPreset } from '../logic/styles.ts';
import { TABLE_STYLE_NAMES, tableStyleParts } from '../logic/tables.ts';
import { FC, RB, S } from '../strings/index.ts';
import type { RibbonEnv } from './env.ts';

/** Formats de la liste deroulante « Format de nombre » (codes canoniques). */
export const NUMBER_FORMATS: readonly { id: string; code: string; icon: 'number_symbol' | 'calendar_ltr' | 'clock' | 'currency_dollar_euro' | 'text_t' }[] = [
  { id: 'General', code: 'General', icon: 'number_symbol' },
  { id: 'number', code: '0.00', icon: 'number_symbol' },
  { id: 'currency', code: '#,##0.00 [$€-40C]', icon: 'currency_dollar_euro' },
  { id: 'accounting', code: '_-* #,##0.00 [$€-40C]_-;-* #,##0.00 [$€-40C]_-;_-* "-"?? [$€-40C]_-;_-@_-', icon: 'currency_dollar_euro' },
  { id: 'shortDate', code: 'dd/mm/yyyy', icon: 'calendar_ltr' },
  { id: 'longDate', code: 'dddd d mmmm yyyy', icon: 'calendar_ltr' },
  { id: 'time', code: 'hh:mm:ss', icon: 'clock' },
  { id: 'percent', code: '0.00%', icon: 'number_symbol' },
  { id: 'fraction', code: '# ?/?', icon: 'number_symbol' },
  { id: 'scientific', code: '0.00E+00', icon: 'number_symbol' },
  { id: 'text', code: '@', icon: 'text_t' },
];

const BORDER_ITEMS: readonly { id: BorderPreset; icon: 'border_bottom' | 'border_top' | 'border_left' | 'border_right' | 'border_none' | 'border_all' | 'border_outside' | 'border_outside_thick' | 'border_bottom_double' | 'border_bottom_thick' | 'border_top_bottom' | 'border_inside' }[] = [
  { id: 'bottom', icon: 'border_bottom' }, { id: 'top', icon: 'border_top' }, { id: 'left', icon: 'border_left' }, { id: 'right', icon: 'border_right' },
  { id: 'none', icon: 'border_none' }, { id: 'all', icon: 'border_all' }, { id: 'outside', icon: 'border_outside' }, { id: 'thickOutside', icon: 'border_outside_thick' },
  { id: 'bottomDouble', icon: 'border_bottom_double' }, { id: 'bottomThick', icon: 'border_bottom_thick' }, { id: 'topBottom', icon: 'border_top_bottom' },
  { id: 'topBottomThick', icon: 'border_top_bottom' }, { id: 'topBottomDouble', icon: 'border_top_bottom' }, { id: 'inside', icon: 'border_inside' },
];

export const BAR_COLORS = ['638EC6', '63C384', 'FF555A', 'FFB628', '008AEF', 'D6007B'];
export const SCALES: readonly (readonly string[])[] = [
  ['F8696B', 'FFEB84', '63BE7B'], ['63BE7B', 'FFEB84', 'F8696B'], ['F8696B', 'FCFCFF', '63BE7B'], ['63BE7B', 'FCFCFF', 'F8696B'],
  ['F8696B', 'FCFCFF', '5A8AC6'], ['5A8AC6', 'FCFCFF', 'F8696B'], ['FCFCFF', 'F8696B'], ['F8696B', 'FCFCFF'], ['FCFCFF', '63BE7B'], ['63BE7B', 'FCFCFF'], ['FFEF9C', '63BE7B'], ['63BE7B', 'FFEF9C'],
];
export const ICON_SETS: readonly IconSetName[] = ['3Arrows', '3ArrowsGray', '4Arrows', '5Arrows', '3TrafficLights1', '3Signs', '4TrafficLights', '3Symbols', '3Flags', '3Stars', '3Triangles', '4Rating', '5Rating', '5Quarters'];

export function homeTab(e: RibbonEnv): RibbonTab {
  const { cmd } = e;
  const f = cmd.activeFont();
  const style = e.wb.styles.cellXfs[cmd.activeStyle()];
  const al = style?.alignment;
  const code = numFmtOf(e.wb, cmd.activeStyle());
  const numId = NUMBER_FORMATS.find((x) => x.code === code)?.id ?? (code === 'General' ? 'General' : 'custom');
  const pasteItems: MenuItem[] = [
    { id: 'all', label: RB.paste, icon: 'clipboard_paste', onClick: () => e.paste('all') },
    { id: 'formulas', label: RB.pasteFormulas, icon: 'math_formula', onClick: () => e.paste('formulas') },
    { id: 'values', label: RB.pasteValues, icon: 'number_symbol', onClick: () => e.paste('values') },
    { id: 'formats', label: RB.pasteFormats, icon: 'paint_brush', onClick: () => e.paste('formats') },
    { id: 'transpose', label: RB.pasteTranspose, icon: 'arrow_rotate_clockwise', onClick: () => e.paste('transpose') },
    { id: 's', kind: 'separator' },
    { id: 'special', label: RB.pasteSpecial, shortcut: 'Ctrl+Alt+V', onClick: () => e.ctx.open({ kind: 'pasteSpecial' }) },
  ];
  const cellStyleItems: GalleryItem[] = CELL_STYLE_PRESETS.filter((p) => p.group !== 'number').map((p) => {
    const fill = p.patch.fill && p.patch.fill.type === 'pattern' ? resolveColor(e.wb, p.patch.fill.fg) : undefined;
    const color = resolveColor(e.wb, p.patch.font?.color);
    return {
      id: p.id,
      label: RB.csNames[p.id] ?? RB.accent(p.id),
      sample: RB.csNames[p.id] ?? RB.accent(p.id),
      style: { background: fill ? `#${fill}` : undefined, color: color ? `#${color}` : undefined, fontWeight: p.patch.font?.bold ? 700 : undefined, fontStyle: p.patch.font?.italic ? 'italic' : undefined, fontSize: 11 },
    };
  });
  const tableItems: GalleryItem[] = TABLE_STYLE_NAMES.map((name) => {
    const parts = tableStyleParts(e.wb, name);
    const fam = name.replace(/^TableStyle(Light|Medium|Dark)\d+$/, '$1');
    return {
      id: name,
      label: `${RB.tsFamily[fam] ?? fam} ${name.replace(/\D+/, '')}`,
      render: () => (
        <span className="xl-tsprev">
          {[parts.header, parts.band1, parts.band2, parts.band1, parts.band2].map((p, i) => (
            <span key={i} style={{ background: p.fill ?? '#FFFFFF', borderBottom: p.bottom ? `1px solid ${p.bottom.color}` : undefined, borderTop: p.top ? `1px solid ${p.top.color}` : undefined }} />
          ))}
        </span>
      ),
    };
  });
  const cfItems: MenuItem[] = [
    {
      id: 'hl', label: RB.cfHighlight, icon: 'highlight', items: [
        { id: 'gt', label: RB.cfGreater, onClick: () => e.ctx.open({ kind: 'cfRule', preset: 'greaterThan' }) },
        { id: 'lt', label: RB.cfLess, onClick: () => e.ctx.open({ kind: 'cfRule', preset: 'lessThan' }) },
        { id: 'bt', label: RB.cfBetween, onClick: () => e.ctx.open({ kind: 'cfRule', preset: 'between' }) },
        { id: 'eq', label: RB.cfEqual, onClick: () => e.ctx.open({ kind: 'cfRule', preset: 'equal' }) },
        { id: 'tx', label: RB.cfText, onClick: () => e.ctx.open({ kind: 'cfRule', preset: 'containsText' }) },
        { id: 'dt', label: RB.cfDate, onClick: () => cmd.addCf({ type: 'timePeriod', timePeriod: 'today' }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
        { id: 'dup', label: RB.cfDup, onClick: () => cmd.addCf({ type: 'duplicateValues' }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
      ],
    },
    {
      id: 'top', label: RB.cfTop, icon: 'data_trending', items: [
        { id: 't10', label: RB.cfTop10, onClick: () => cmd.addCf({ type: 'top10', rank: 10 }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
        { id: 't10p', label: RB.cfTop10p, onClick: () => cmd.addCf({ type: 'top10', rank: 10, percent: true }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
        { id: 'b10', label: RB.cfBottom10, onClick: () => cmd.addCf({ type: 'top10', rank: 10, bottom: true }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
        { id: 'above', label: RB.cfAbove, onClick: () => cmd.addCf({ type: 'aboveAverage', aboveAverage: true }, { font: { color: { rgb: 'FF006100' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFC6EFCE' } } }) },
        { id: 'below', label: RB.cfBelow, onClick: () => cmd.addCf({ type: 'aboveAverage', aboveAverage: false }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
      ],
    },
    {
      id: 'bars', label: RB.cfBars, icon: 'data_bar_horizontal', items: [
        { id: 'hg', kind: 'header', label: RB.gradient },
        ...BAR_COLORS.map((c) => ({ id: `g${c}`, label: `${RB.gradient} ${c}`, adornment: <span className="xl-barprev" style={{ background: `linear-gradient(90deg, #${c}, #fff)` }} />, onClick: () => cmd.dataBar(c, true) })),
        { id: 'hs', kind: 'header', label: RB.solid },
        ...BAR_COLORS.map((c) => ({ id: `s${c}`, label: `${RB.solid} ${c}`, adornment: <span className="xl-barprev" style={{ background: `#${c}` }} />, onClick: () => cmd.dataBar(c, false) })),
      ],
    },
    {
      id: 'scales', label: RB.cfScales, icon: 'color', items: SCALES.map((s, i) => ({
        id: `sc${i}`, label: s.map((c) => `#${c}`).join(' → '), adornment: <span className="xl-barprev" style={{ background: `linear-gradient(90deg, ${s.map((c) => `#${c}`).join(',')})` }} />, onClick: () => cmd.colorScale(s),
      })),
    },
    { id: 'icons', label: RB.cfIcons, icon: 'star', items: ICON_SETS.map((set) => ({ id: set, label: S.iconSetNames[set] ?? set, onClick: () => e.iconSet(set) })) },
    { id: 's1', kind: 'separator' },
    { id: 'new', label: RB.cfNew, onClick: () => e.ctx.open({ kind: 'cfRule' }) },
    { id: 'clr', label: RB.cfClear, items: [
      { id: 'cs', label: RB.cfClearSel, onClick: () => cmd.clearCf('selection') },
      { id: 'ch', label: RB.cfClearSheet, onClick: () => cmd.clearCf('sheet') },
    ] },
    { id: 'manage', label: RB.cfManage, onClick: () => e.ctx.open({ kind: 'cfManage' }) },
  ];
  return {
    id: 'home', label: RB.tabs.home, keytip: 'L',
    groups: [
      {
        id: 'clipboard', label: RB.g.clipboard, icon: 'clipboard_paste',
        launcher: { label: RB.pasteSpecial, onClick: () => e.ctx.open({ kind: 'pasteSpecial' }) },
        controls: [
          { kind: 'split', id: 'paste', label: RB.paste, icon: 'clipboard_paste', size: 'large', onClick: () => e.paste(), items: pasteItems, tooltip: { title: RB.paste, shortcut: 'Ctrl+V' } },
          { kind: 'button', id: 'cut', label: RB.cut, icon: 'cut', onClick: e.cut, tooltip: { title: RB.cut, shortcut: 'Ctrl+X' } },
          { kind: 'button', id: 'copy', label: RB.copy, icon: 'copy', onClick: e.copy, tooltip: { title: RB.copy, shortcut: 'Ctrl+C' } },
          { kind: 'toggle', id: 'painter', label: RB.painter, icon: 'paint_brush', pressed: e.painter.active, onToggle: () => e.painter.start() },
        ],
      },
      {
        id: 'font', label: RB.g.font, icon: 'text_font',
        launcher: { label: RB.font, onClick: () => e.ctx.open({ kind: 'formatCells', tab: 'font' }) },
        controls: [
          { kind: 'row', id: 'f1', controls: [
            { kind: 'font', id: 'fontname', label: RB.font, value: f.name, width: 130, onChange: cmd.fontName },
            { kind: 'combo', id: 'fontsize', label: RB.size, value: String(f.size), options: FONT_SIZE_OPTIONS, editable: true, width: 50, validate: validateFontSize, onChange: (v) => cmd.fontSize(Number(v)) },
            { kind: 'button', id: 'grow', label: RB.grow, icon: 'text_font_size', iconOnly: true, onClick: () => cmd.growFont(1) },
            { kind: 'button', id: 'shrink', label: RB.shrink, icon: 'text_font', iconOnly: true, onClick: () => cmd.growFont(-1) },
          ] },
          { kind: 'row', id: 'f2', controls: [
            { kind: 'toggle', id: 'bold', label: RB.bold, icon: 'text_bold', iconOnly: true, pressed: !!f.bold, onToggle: cmd.bold, tooltip: { title: RB.bold, shortcut: 'Ctrl+G' } },
            { kind: 'toggle', id: 'italic', label: RB.italic, icon: 'text_italic', iconOnly: true, pressed: !!f.italic, onToggle: cmd.italic, tooltip: { title: RB.italic, shortcut: 'Ctrl+I' } },
            { kind: 'toggle', id: 'underline', label: RB.underline, icon: 'text_underline', iconOnly: true, pressed: !!f.underline, onToggle: () => cmd.underline(), tooltip: { title: RB.underline, shortcut: 'Ctrl+U' } },
            {
              kind: 'split', id: 'borders', label: RB.borders, icon: 'border_bottom', iconOnly: true, onClick: () => cmd.borders('bottom'),
              items: [
                ...BORDER_ITEMS.map((b) => ({ id: b.id, label: RB.b[b.id] ?? b.id, icon: b.icon, onClick: () => cmd.borders(b.id) })),
                { id: 'moreSep', kind: 'separator' as const },
                { id: 'moreBorders', label: FC.moreBorders, onClick: () => e.ctx.open({ kind: 'formatCells', tab: 'border' }) },
              ],
            },
            { kind: 'color', id: 'fill', label: RB.fill, icon: 'paint_bucket', iconOnly: true, value: '#FFFF00', emptyMode: 'none', onChange: cmd.fillColor },
            { kind: 'color', id: 'fontcolor', label: RB.fontColor, icon: 'text_color', iconOnly: true, value: '#C00000', onChange: cmd.fontColor },
          ] },
        ],
      },
      {
        id: 'align', label: RB.g.alignment, icon: 'text_align_center',
        launcher: { label: RB.g.alignment, onClick: () => e.ctx.open({ kind: 'formatCells', tab: 'align' }) },
        controls: [
          { kind: 'row', id: 'a1', controls: [
            { kind: 'toggle', id: 'top', label: RB.alignTop, icon: 'align_top', iconOnly: true, pressed: al?.vertical === 'top', onToggle: () => cmd.valign('top') },
            { kind: 'toggle', id: 'middle', label: RB.alignMiddle, icon: 'align_center_vertical', iconOnly: true, pressed: al?.vertical === 'center', onToggle: () => cmd.valign('center') },
            { kind: 'toggle', id: 'bottom', label: RB.alignBottom, icon: 'align_bottom', iconOnly: true, pressed: !al?.vertical || al.vertical === 'bottom', onToggle: () => cmd.valign('bottom') },
            {
              kind: 'menu', id: 'orient', label: RB.orientation, icon: 'text_direction_rotate_90_ltr', iconOnly: true, items: [
                { id: 'up', label: RB.rotUp, onClick: () => cmd.rotate(45) },
                { id: 'down', label: RB.rotDown, onClick: () => cmd.rotate(135) },
                { id: 'vert', label: RB.rotVertical, onClick: () => cmd.rotate(90) },
                { id: 'none', label: RB.rotNone, onClick: () => cmd.rotate(0) },
              ],
            },
            // Champs du panneau Parametres OnlyOffice (masques dans le ruban) : retrait, angle, reduire pour ajuster.
            { kind: 'number', id: 'ooindent', label: 'Retrait', hidden: true, value: al?.indent ?? 0, min: 0, max: 15, step: 1, width: 64, onChange: cmd.indentTo },
            { kind: 'number', id: 'ooangle', label: 'Angle', hidden: true, value: al?.textRotation ?? 0, min: -90, max: 90, step: 1, unit: '°', width: 64, onChange: cmd.rotate },
            { kind: 'toggle', id: 'ooshrink', label: 'Réduire pour ajuster', hidden: true, pressed: !!al?.shrinkToFit, onToggle: () => cmd.shrink() },
            { kind: 'toggle', id: 'wrap', label: RB.wrap, icon: 'text_wrap', pressed: !!al?.wrapText, onToggle: cmd.wrap },
          ] },
          { kind: 'row', id: 'a2', controls: [
            { kind: 'toggle', id: 'left', label: RB.alignLeft, icon: 'text_align_left', iconOnly: true, pressed: al?.horizontal === 'left', onToggle: () => cmd.align('left') },
            { kind: 'toggle', id: 'center', label: RB.center, icon: 'text_align_center', iconOnly: true, pressed: al?.horizontal === 'center', onToggle: () => cmd.align('center') },
            { kind: 'toggle', id: 'right', label: RB.alignRight, icon: 'text_align_right', iconOnly: true, pressed: al?.horizontal === 'right', onToggle: () => cmd.align('right') },
            { kind: 'button', id: 'indDec', label: RB.indentDec, icon: 'text_indent_decrease_ltr', iconOnly: true, onClick: () => cmd.indent(-1) },
            { kind: 'button', id: 'indInc', label: RB.indentInc, icon: 'text_indent_increase_ltr', iconOnly: true, onClick: () => cmd.indent(1) },
            {
              kind: 'split', id: 'merge', label: RB.merge, icon: 'table_cells_merge', onClick: () => cmd.merge('center'), items: [
                { id: 'center', label: RB.merge, onClick: () => cmd.merge('center') },
                { id: 'across', label: RB.mergeAcross, onClick: () => cmd.merge('across') },
                { id: 'merge', label: RB.mergeCells, onClick: () => cmd.merge('merge') },
                { id: 'unmerge', label: RB.unmerge, onClick: () => cmd.merge('unmerge') },
              ],
            },
          ] },
        ],
      },
      {
        id: 'number', label: RB.g.number, icon: 'number_symbol',
        launcher: { label: RB.g.number, onClick: () => e.ctx.open({ kind: 'formatCells', tab: 'number' }) },
        controls: [
          {
            kind: 'combo', id: 'numfmt', label: RB.numFormat, value: numId === 'custom' ? code : RB.formats[numId] ?? numId, width: 120,
            options: [...NUMBER_FORMATS.map((n) => ({ value: RB.formats[n.id] ?? n.id })), ...(numId === 'custom' ? [{ value: code }] : []), { value: RB.formats.more ?? '' }],
            onChange: (v) => {
              if (v === RB.formats.more) e.ctx.open({ kind: 'formatCells', tab: 'number' });
              const fmt = NUMBER_FORMATS.find((n) => (RB.formats[n.id] ?? n.id) === v);
              if (fmt) cmd.numberFormat(fmt.code);
            },
          },
          { kind: 'row', id: 'n2', controls: [
            {
              kind: 'split', id: 'currency', label: RB.currency, icon: 'currency_dollar_euro', iconOnly: true, onClick: () => cmd.numberFormat(NUMBER_FORMATS[3]?.code ?? ''), items: [
                { id: 'eur', label: '€ Euro (€ 123)', onClick: () => cmd.numberFormat(NUMBER_FORMATS[3]?.code ?? '') },
                { id: 'usd', label: '$ Anglais (États-Unis)', onClick: () => cmd.numberFormat('_-[$$-409]* #,##0.00_-;-[$$-409]* #,##0.00_-;_-[$$-409]* "-"??_-;_-@_-') },
                { id: 'gbp', label: '£ Anglais (Royaume-Uni)', onClick: () => cmd.numberFormat('_-[$£-809]* #,##0.00_-;-[$£-809]* #,##0.00_-;_-[$£-809]* "-"??_-;_-@_-') },
                { id: 'chf', label: 'CHF Français (Suisse)', onClick: () => cmd.numberFormat('_-* #,##0.00 [$CHF-100C]_-;-* #,##0.00 [$CHF-100C]_-;_-* "-"?? [$CHF-100C]_-;_-@_-') },
                { id: 'moreAcc', label: FC.moreAccounting, onClick: () => e.ctx.open({ kind: 'formatCells', tab: 'number', category: 'accounting' }) },
              ],
            },
            { kind: 'button', id: 'percent', label: RB.percent, icon: 'number_symbol', iconOnly: true, onClick: () => cmd.numberFormat('0%'), tooltip: { title: RB.percent, shortcut: 'Ctrl+Maj+%' } },
            { kind: 'button', id: 'comma', label: RB.comma, icon: 'number_row', iconOnly: true, onClick: () => cmd.cellStyle('comma') },
            { kind: 'button', id: 'decInc', label: RB.decInc, icon: 'decimal_arrow_right', iconOnly: true, onClick: () => cmd.decimals(1) },
            { kind: 'button', id: 'decDec', label: RB.decDec, icon: 'decimal_arrow_left', iconOnly: true, onClick: () => cmd.decimals(-1) },
          ] },
        ],
      },
      {
        id: 'styles', label: RB.g.styles, icon: 'paint_brush',
        controls: [
          { kind: 'menu', id: 'cf', label: RB.cf, icon: 'table_lightning', size: 'large', items: cfItems },
          { kind: 'gallery', id: 'asTable', label: RB.asTable, icon: 'table', items: tableItems, itemWidth: 56, columns: 7, onSelect: (style: string) => e.ctx.open({ kind: 'createTable', style }) },
          { kind: 'gallery', id: 'cellStyles', label: RB.cellStyles, icon: 'paint_brush', items: cellStyleItems, itemWidth: 96, columns: 6, onSelect: cmd.cellStyle },
        ],
      },
      {
        id: 'cells', label: RB.g.cells, icon: 'table',
        controls: [
          {
            kind: 'split', id: 'insert', label: RB.insert, icon: 'table_insert_row', size: 'large', onClick: () => cmd.insert('cellsDown'), items: [
              { id: 'dlg', label: S.cellsDlg.insertTitle + '…', onClick: () => e.ctx.open({ kind: 'insertCells' }) },
              { id: 'cd', label: RB.cellsDown, onClick: () => cmd.insert('cellsDown') },
              { id: 'cr', label: RB.cellsRight, onClick: () => cmd.insert('cellsRight') },
              { id: 'rows', label: RB.insertRows, icon: 'table_insert_row', onClick: () => cmd.insert('rows') },
              { id: 'cols', label: RB.insertCols, icon: 'table_insert_column', onClick: () => cmd.insert('cols') },
              { id: 'sheet', label: RB.insertSheet, icon: 'tab_add', onClick: e.addSheet },
            ],
          },
          {
            kind: 'split', id: 'delete', label: RB.del, icon: 'table_delete_row', size: 'large', onClick: () => cmd.remove('cellsUp'), items: [
              { id: 'dlg', label: S.cellsDlg.deleteTitle + '…', onClick: () => e.ctx.open({ kind: 'deleteCells' }) },
              { id: 'cu', label: RB.cellsUp, onClick: () => cmd.remove('cellsUp') },
              { id: 'cl', label: RB.cellsLeft, onClick: () => cmd.remove('cellsLeft') },
              { id: 'rows', label: RB.delRows, icon: 'table_delete_row', onClick: () => cmd.remove('rows') },
              { id: 'cols', label: RB.delCols, icon: 'table_delete_column', onClick: () => cmd.remove('cols') },
              { id: 'sheet', label: RB.delSheet, icon: 'delete', onClick: e.deleteSheet },
            ],
          },
          {
            kind: 'menu', id: 'format', label: RB.format, icon: 'table_settings', size: 'large', items: [
              { id: 'rh', label: RB.rowHeight, icon: 'table_resize_row', onClick: () => e.ctx.open({ kind: 'size', axis: 'row' }) },
              { id: 'ar', label: RB.autoRow, icon: 'arrow_autofit_height', onClick: () => e.autofit('row') },
              { id: 'cw', label: RB.colWidth, icon: 'table_resize_column', onClick: () => e.ctx.open({ kind: 'size', axis: 'col' }) },
              { id: 'ac', label: RB.autoCol, icon: 'arrow_autofit_width', onClick: () => e.autofit('col') },
              { id: 's1', kind: 'separator' },
              { id: 'hr', label: RB.hideRows, onClick: () => cmd.hide('row', true) },
              { id: 'hc', label: RB.hideCols, onClick: () => cmd.hide('col', true) },
              { id: 'sr', label: RB.showRows, onClick: () => cmd.hide('row', false) },
              { id: 'sc', label: RB.showCols, onClick: () => cmd.hide('col', false) },
              { id: 'hs', label: RB.hideSheet, onClick: () => cmd.sheetState(e.si, 'hidden') },
              { id: 'ss', label: RB.showSheet, onClick: () => e.ctx.open({ kind: 'unhideSheet' }) },
              { id: 's2', kind: 'separator' },
              { id: 'ren', label: RB.renameSheet, icon: 'rename', onClick: e.renameSheet },
              { id: 'prot', label: RB.protectSheet, icon: 'shield_lock', onClick: () => e.protectToggle('sheet') },
              { id: 'fc', label: RB.formatCells, icon: 'table_cell_edit', shortcut: 'Ctrl+1', onClick: () => e.ctx.open({ kind: 'formatCells' }) },
            ],
          },
        ],
      },
      {
        id: 'editing', label: RB.g.editing, icon: 'autosum',
        controls: [
          {
            kind: 'split', id: 'autosum', label: RB.autoSum, icon: 'autosum', onClick: () => cmd.autoSum('SUM'), tooltip: { title: RB.autoSum, shortcut: 'Alt+=' }, items: [
              { id: 'sum', label: RB.sum, onClick: () => cmd.autoSum('SUM') },
              { id: 'avg', label: RB.average, onClick: () => cmd.autoSum('AVERAGE') },
              { id: 'cnt', label: RB.countNumbers, onClick: () => cmd.autoSum('COUNT') },
              { id: 'max', label: RB.max, onClick: () => cmd.autoSum('MAX') },
              { id: 'min', label: RB.min, onClick: () => cmd.autoSum('MIN') },
              { id: 'more', label: RB.moreFunctions, onClick: () => e.insertFunction() },
            ],
          },
          {
            kind: 'menu', id: 'fillm', label: RB.fillMenu, icon: 'arrow_down', items: [
              { id: 'd', label: RB.fillDown, icon: 'arrow_down', shortcut: 'Ctrl+B', onClick: () => cmd.fill('down') },
              { id: 'r', label: RB.fillRight, icon: 'arrow_right', shortcut: 'Ctrl+D', onClick: () => cmd.fill('right') },
              { id: 'u', label: RB.fillUp, icon: 'arrow_up', onClick: () => cmd.fill('up') },
              { id: 'l', label: RB.fillLeft, icon: 'arrow_left', onClick: () => cmd.fill('left') },
              { id: 's', label: RB.fillSeries, onClick: () => e.ctx.open({ kind: 'series' }) },
              { id: 'ff', label: RB.flashFill, icon: 'flow', shortcut: 'Ctrl+E', onClick: e.flashFill },
            ],
          },
          {
            kind: 'menu', id: 'clear', label: RB.clear, icon: 'eraser', items: [
              { id: 'all', label: RB.clearAll, onClick: () => cmd.clear('all') },
              { id: 'fmt', label: RB.clearFormats, onClick: () => cmd.clear('formats') },
              { id: 'cnt', label: RB.clearContents, onClick: () => cmd.clear('contents') },
              { id: 'cmt', label: RB.clearComments, onClick: () => cmd.clear('comments') },
              { id: 'lnk', label: RB.clearLinks, onClick: () => cmd.clear('links') },
            ],
          },
          {
            kind: 'menu', id: 'sortfilter', label: RB.sortFilter, icon: 'arrow_sort', size: 'large', items: [
              { id: 'asc', label: RB.sortAsc, icon: 'text_sort_ascending', onClick: () => cmd.sortQuick(false) },
              { id: 'desc', label: RB.sortDesc, icon: 'text_sort_descending', onClick: () => cmd.sortQuick(true) },
              { id: 'custom', label: RB.customSort, icon: 'arrow_sort', onClick: () => e.ctx.open({ kind: 'sort' }) },
              { id: 's', kind: 'separator' },
              { id: 'filter', label: RB.filter, icon: 'filter', shortcut: 'Ctrl+Maj+L', checked: !!e.sheet.autoFilter, onClick: cmd.toggleFilter },
              { id: 'clear', label: RB.clearFilter, icon: 'filter_dismiss', disabled: !e.sheet.autoFilter, onClick: cmd.clearFilters },
              { id: 're', label: RB.reapply, disabled: !e.sheet.autoFilter, onClick: cmd.reapplyFilter },
            ],
          },
          {
            kind: 'menu', id: 'find', label: RB.findSelect, icon: 'search', size: 'large', items: [
              { id: 'find', label: RB.find, icon: 'search', shortcut: 'Ctrl+F', onClick: () => e.ctx.open({ kind: 'find', replace: false }) },
              { id: 'replace', label: RB.replace, shortcut: 'Ctrl+H', onClick: () => e.ctx.open({ kind: 'find', replace: true }) },
              { id: 'goto', label: RB.goTo, shortcut: 'Ctrl+T', onClick: () => e.ctx.open({ kind: 'goto' }) },
            ],
          },
        ],
      },
    ],
  };
}

