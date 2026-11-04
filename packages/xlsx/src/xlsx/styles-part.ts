// Partie styles.xml : lecture et ecriture des tables normalisees.
import { el, type XmlElement } from '@forgeoffice/opc';
import type { CellFormat, CustomTableStyle, Styles, TableStyleElementType } from '../model.ts';
import { defaultStyles } from '../workbook.ts';
import { NS_MAIN } from './ns.ts';
import {
  alignmentEl, borderEl, colorEl, dxfEl, fillEl, fontEl, normalizeArgb, protectionEl, readAlignment, readBorder,
  readColor, readDxf, readFill, readFont, readProtection,
} from './style-xml.ts';
import { b1, int, kid, kids, optBool, str } from './xml-util.ts';

function readXf(node: XmlElement, withParent: boolean): CellFormat {
  const xf: CellFormat = {
    numFmtId: int(node, 'numFmtId') ?? 0,
    fontId: int(node, 'fontId') ?? 0,
    fillId: int(node, 'fillId') ?? 0,
    borderId: int(node, 'borderId') ?? 0,
  };
  if (withParent) xf.xfId = int(node, 'xfId') ?? 0;
  const alignment = readAlignment(kid(node, 'alignment'));
  if (alignment) xf.alignment = alignment;
  const protection = readProtection(kid(node, 'protection'));
  if (protection) xf.protection = protection;
  if (optBool(node, 'quotePrefix')) xf.quotePrefix = true;
  return xf;
}

export function readStyles(root: XmlElement | undefined): Styles {
  const styles = defaultStyles();
  if (!root) return styles;
  styles.numFmts = kids(kid(root, 'numFmts'), 'numFmt').map((n) => ({
    id: int(n, 'numFmtId') ?? 0,
    code: str(n, 'formatCode') ?? 'General',
  }));
  const fonts = kids(kid(root, 'fonts'), 'font').map(readFont);
  if (fonts.length) styles.fonts = fonts;
  const fills = kids(kid(root, 'fills'), 'fill').map(readFill);
  if (fills.length) styles.fills = fills;
  const borders = kids(kid(root, 'borders'), 'border').map(readBorder);
  if (borders.length) styles.borders = borders;
  const styleXfs = kids(kid(root, 'cellStyleXfs'), 'xf').map((n) => readXf(n, false));
  if (styleXfs.length) styles.cellStyleXfs = styleXfs;
  const cellXfs = kids(kid(root, 'cellXfs'), 'xf').map((n) => readXf(n, true));
  if (cellXfs.length) styles.cellXfs = cellXfs;
  const cellStyles = kids(kid(root, 'cellStyles'), 'cellStyle').map((n) => {
    const style: Styles['cellStyles'][number] = { name: str(n, 'name') ?? '', xfId: int(n, 'xfId') ?? 0 };
    const builtin = int(n, 'builtinId');
    if (builtin !== undefined) style.builtinId = builtin;
    if (optBool(n, 'customBuiltin')) style.customBuiltin = true;
    if (optBool(n, 'hidden')) style.hidden = true;
    const level = int(n, 'iLevel');
    if (level !== undefined) style.outlineLevel = level;
    return style;
  });
  if (cellStyles.length) styles.cellStyles = cellStyles;
  styles.dxfs = kids(kid(root, 'dxfs'), 'dxf').map(readDxf);
  const tableStyles = kid(root, 'tableStyles');
  if (tableStyles) {
    const defTable = str(tableStyles, 'defaultTableStyle');
    if (defTable) styles.defaultTableStyle = defTable;
    const defPivot = str(tableStyles, 'defaultPivotStyle');
    if (defPivot) styles.defaultPivotStyle = defPivot;
    styles.tableStyles = kids(tableStyles, 'tableStyle').map((n): CustomTableStyle => {
      const style: CustomTableStyle = {
        name: str(n, 'name') ?? '',
        elements: kids(n, 'tableStyleElement').map((e) => {
          const item: CustomTableStyle['elements'][number] = {
            type: (str(e, 'type') ?? 'wholeTable') as TableStyleElementType,
            dxfId: int(e, 'dxfId') ?? 0,
          };
          const size = int(e, 'size');
          if (size !== undefined) item.size = size;
          return item;
        }),
      };
      const pivot = optBool(n, 'pivot');
      if (pivot !== undefined) style.pivot = pivot;
      const table = optBool(n, 'table');
      if (table !== undefined) style.table = table;
      return style;
    });
  }
  const colors = kid(root, 'colors');
  const indexed = kids(kid(colors, 'indexedColors'), 'rgbColor').map((n) => normalizeArgb(str(n, 'rgb') ?? '000000'));
  if (indexed.length) styles.indexedColors = indexed;
  const mru = kids(kid(colors, 'mruColors'), 'color').map(readColor).filter((c) => c !== undefined);
  if (mru.length) styles.mruColors = mru;
  // Garanties minimales pour que les index restent valides.
  if (styles.fills.length < 2) styles.fills = defaultStyles().fills;
  return styles;
}

function xfEl(xf: CellFormat, cellXf: boolean): XmlElement {
  return el('xf', {
    numFmtId: xf.numFmtId,
    fontId: xf.fontId,
    fillId: xf.fillId,
    borderId: xf.borderId,
    xfId: cellXf ? (xf.xfId ?? 0) : undefined,
    quotePrefix: b1(xf.quotePrefix),
    applyNumberFormat: cellXf && xf.numFmtId !== 0 ? '1' : undefined,
    applyFont: cellXf && xf.fontId !== 0 ? '1' : undefined,
    applyFill: cellXf && xf.fillId !== 0 ? '1' : undefined,
    applyBorder: cellXf && xf.borderId !== 0 ? '1' : undefined,
    applyAlignment: xf.alignment ? '1' : undefined,
    applyProtection: xf.protection ? '1' : undefined,
  }, [...alignmentEl(xf.alignment), ...protectionEl(xf.protection)]);
}

function counted(name: string, list: XmlElement[]): XmlElement {
  return el(name, { count: list.length }, list);
}

export function writeStyles(styles: Styles): XmlElement {
  const fills = styles.fills.length >= 2 ? styles.fills : defaultStyles().fills;
  const kidsOut: XmlElement[] = [];
  if (styles.numFmts.length) {
    kidsOut.push(counted('numFmts', styles.numFmts.map((f) => el('numFmt', { numFmtId: f.id, formatCode: f.code }))));
  }
  kidsOut.push(
    el('fonts', { count: styles.fonts.length, 'x14ac:knownFonts': '1' }, styles.fonts.map((f) => fontEl('font', f))),
    counted('fills', fills.map(fillEl)),
    counted('borders', (styles.borders.length ? styles.borders : [{}]).map((b) => borderEl(b))),
    counted('cellStyleXfs', styles.cellStyleXfs.map((xf) => xfEl(xf, false))),
    counted('cellXfs', styles.cellXfs.map((xf) => xfEl(xf, true))),
    counted('cellStyles', styles.cellStyles.map((s) => el('cellStyle', {
      name: s.name,
      xfId: s.xfId,
      builtinId: s.builtinId,
      iLevel: s.outlineLevel,
      hidden: b1(s.hidden),
      customBuiltin: b1(s.customBuiltin),
    }))),
    counted('dxfs', styles.dxfs.map(dxfEl)),
    el('tableStyles', {
      count: styles.tableStyles.length,
      defaultTableStyle: styles.defaultTableStyle ?? 'TableStyleMedium2',
      defaultPivotStyle: styles.defaultPivotStyle ?? 'PivotStyleLight16',
    }, styles.tableStyles.map((t) => el('tableStyle', {
      name: t.name,
      pivot: t.pivot === undefined ? undefined : t.pivot ? '1' : '0',
      table: t.table === undefined ? undefined : t.table ? '1' : '0',
      count: t.elements.length,
    }, t.elements.map((e) => el('tableStyleElement', { type: e.type, size: e.size, dxfId: e.dxfId }))))),
  );
  if (styles.indexedColors || styles.mruColors) {
    const colors: XmlElement[] = [];
    if (styles.indexedColors) colors.push(el('indexedColors', {}, styles.indexedColors.map((rgb) => el('rgbColor', { rgb }))));
    if (styles.mruColors) colors.push(el('mruColors', {}, styles.mruColors.flatMap((c) => colorEl('color', c))));
    kidsOut.push(el('colors', {}, colors));
  }
  return el('styleSheet', {
    xmlns: NS_MAIN,
    'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'mc:Ignorable': 'x14ac',
    'xmlns:x14ac': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
  }, kidsOut);
}
