// Lecture des classeurs OpenDocument (.ods) : feuilles, valeurs, formules, fusions, largeurs, hauteurs,
// styles de base (gras, italique, couleurs, alignement, formats de nombre), plages nommees.
import { OpcPackage, PackageError, textOf, XmlError, type XmlElement, isElement } from '@forgeoffice/opc';
import { MAX_COLS, MAX_ROWS, type Cell, type CellRange, type DataValidation, type Font, type Sheet, type Workbook } from '../model.ts';
import { SpreadsheetError, strings } from '../strings.ts';
import { createBlankWorkbook, createSheet, dateToSerial, parseErrorCode, styleIdFor, uniqueSheetName, type StyleSpec } from '../workbook.ts';
import { kid, kids, localName, str } from '../xlsx/xml-util.ts';
import { lengthToPt, odfToExcelFormula, ptToColWidth } from './ods-common.ts';
import {
  applySettings, conditionalFromStyleMaps, isFrame, mergeRuns, paragraphRuns, readAnnotation, readConditionalFormats, readFrame,
  readFrameCharts, readValidations, type OdsFrame,
} from './ods-extras.ts';

interface OdsStyles {
  columns: Map<string, { widthPt?: number }>;
  rows: Map<string, { heightPt?: number }>;
  tables: Map<string, { hidden: boolean; tabColor?: string }>;
  cells: Map<string, StyleSpec>;
  numberFormats: Map<string, string>;
  /** Styles de caracteres (spans du texte enrichi). */
  text: Map<string, Partial<Font>>;
  /** Styles de cellule portant des conditions (style:map). */
  maps: Map<string, { condition: string; style: string }[]>;
}

/** Texte d'une cellule : paragraphes « text:p » avec espaces (« text:s »), tabulations et sauts de ligne. */
function cellText(cell: XmlElement): string {
  const paragraph = (node: XmlElement): string => node.children.map((n) => {
    if (typeof n === 'string') return n;
    const name = localName(n.name);
    if (name === 's') return ' '.repeat(Math.min(Number(n.attrs['text:c'] ?? 1) || 1, 1000));
    if (name === 'tab') return '\t';
    if (name === 'line-break') return '\n';
    if (name === 'annotation') return '';
    return paragraph(n);
  }).join('');
  return kids(cell, 'p').map(paragraph).join('\n');
}

function numberStyleCode(node: XmlElement): string {
  const tag = localName(node.name);
  const parts: string[] = [];
  for (const child of node.children) {
    if (!isElement(child)) continue;
    const name = localName(child.name);
    const attr = (key: string): string | undefined => child.attrs[`number:${key}`];
    switch (name) {
      case 'number': {
        const decimals = Number(attr('decimal-places') ?? 0);
        const grouping = attr('grouping') === 'true';
        const min = Number(attr('min-integer-digits') ?? 1);
        parts.push(`${grouping ? '#,##' : ''}${'0'.repeat(Math.max(1, min))}${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}`);
        break;
      }
      case 'scientific-number':
        parts.push(`0.${'0'.repeat(Number(attr('decimal-places') ?? 2))}E+00`);
        break;
      case 'day': parts.push(attr('style') === 'long' ? 'dd' : 'd'); break;
      case 'month': parts.push(attr('textual') === 'true' ? (attr('style') === 'long' ? 'mmmm' : 'mmm') : attr('style') === 'long' ? 'mm' : 'm'); break;
      case 'year': parts.push(attr('style') === 'long' ? 'yyyy' : 'yy'); break;
      case 'hours': parts.push(attr('style') === 'long' ? 'hh' : 'h'); break;
      case 'minutes': parts.push('mm'); break;
      case 'seconds': parts.push('ss'); break;
      case 'am-pm': parts.push('AM/PM'); break;
      case 'day-of-week': parts.push(attr('style') === 'long' ? 'dddd' : 'ddd'); break;
      case 'text': {
        const t = textOf(child);
        parts.push(/^[\s/:.,%-]*$/.test(t) ? t : `"${t.replace(/"/g, '')}"`);
        break;
      }
      case 'currency-symbol': parts.push(`"${textOf(child)}"`); break;
      case 'text-content': parts.push('@'); break;
      default: break;
    }
  }
  const code = parts.join('');
  if (tag === 'percentage-style') return code.includes('%') ? code : `${code}%`;
  if (tag === 'text-style' && !code) return '@';
  return code || 'General';
}

function parseColor(value: string | undefined): { rgb: string } | undefined {
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) return undefined;
  return { rgb: `FF${value.slice(1).toUpperCase()}` };
}

function readStyles(roots: XmlElement[]): OdsStyles {
  const styles: OdsStyles = { columns: new Map(), rows: new Map(), tables: new Map(), cells: new Map(), numberFormats: new Map(), text: new Map(), maps: new Map() };
  for (const root of roots) {
    for (const container of [kid(root, 'automatic-styles'), kid(root, 'styles')]) {
      for (const node of kids(container)) {
        const name = str(node, 'style:name');
        if (!name) continue;
        const tag = localName(node.name);
        if (tag.endsWith('-style') && tag !== 'default-style') {
          styles.numberFormats.set(name, numberStyleCode(node));
          continue;
        }
        if (tag !== 'style') continue;
        const family = str(node, 'style:family');
        if (family === 'table-column') {
          styles.columns.set(name, { widthPt: lengthToPt(str(kid(node, 'table-column-properties'), 'style:column-width')) });
        } else if (family === 'table-row') {
          const props = kid(node, 'table-row-properties');
          const custom = str(props, 'style:use-optimal-row-height') !== 'true';
          styles.rows.set(name, custom ? { heightPt: lengthToPt(str(props, 'style:row-height')) } : {});
        } else if (family === 'table') {
          const props = kid(node, 'table-properties');
          const tab = parseColor(str(props, 'tableooo:tab-color') ?? str(props, 'table:tab-color'));
          styles.tables.set(name, { hidden: str(props, 'table:display') === 'false', ...(tab ? { tabColor: tab.rgb } : {}) });
        } else if (family === 'table-cell') {
          styles.cells.set(name, cellSpec(node, styles));
          const maps = kids(node, 'map').map((m) => ({ condition: str(m, 'style:condition') ?? '', style: str(m, 'style:apply-style-name') ?? '' }));
          if (maps.length) styles.maps.set(name, maps);
        } else if (family === 'text') {
          const font = cellSpec(node, styles).font;
          if (font) styles.text.set(name, font);
        }
      }
    }
  }
  return styles;
}

function cellSpec(node: XmlElement, styles: OdsStyles): StyleSpec {
  const spec: StyleSpec = {};
  const text = kid(node, 'text-properties');
  const cellProps = kid(node, 'table-cell-properties');
  const para = kid(node, 'paragraph-properties');
  const font: StyleSpec['font'] = {};
  if (str(text, 'fo:font-weight') === 'bold') font.bold = true;
  if (str(text, 'fo:font-style') === 'italic') font.italic = true;
  const color = parseColor(str(text, 'fo:color'));
  if (color) font.color = color;
  const size = lengthToPt(str(text, 'fo:font-size'));
  if (size) font.size = size;
  const fontName = str(text, 'style:font-name');
  if (fontName) font.name = fontName;
  if (str(text, 'style:text-underline-style') && str(text, 'style:text-underline-style') !== 'none') font.underline = 'single';
  if (str(text, 'style:text-line-through-style') && str(text, 'style:text-line-through-style') !== 'none') font.strike = true;
  if (Object.keys(font).length) spec.font = font;
  const bg = parseColor(str(cellProps, 'fo:background-color'));
  if (bg) spec.fill = { type: 'pattern', pattern: 'solid', fg: bg };
  const align = str(para, 'fo:text-align');
  const horizontal = align === 'center' ? 'center' : align === 'end' || align === 'right' ? 'right' : align === 'start' || align === 'left' ? 'left' : align === 'justify' ? 'justify' : undefined;
  const vAlign = str(cellProps, 'style:vertical-align');
  const vertical = vAlign === 'middle' ? 'center' : vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : undefined;
  const wrap = str(cellProps, 'fo:wrap-option') === 'wrap';
  if (horizontal || vertical || wrap) spec.alignment = { ...(horizontal ? { horizontal } : {}), ...(vertical ? { vertical } : {}), ...(wrap ? { wrapText: true } : {}) };
  const border = str(cellProps, 'fo:border');
  if (border && border !== 'none') {
    const edge = { style: border.includes('double') ? 'double' as const : 'thin' as const, color: parseColor(border.match(/#[0-9a-fA-F]{6}/)?.[0]) ?? { rgb: 'FF000000' } };
    spec.border = { left: edge, right: edge, top: edge, bottom: edge };
  }
  const dataStyle = str(node, 'style:data-style-name');
  const code = dataStyle ? styles.numberFormats.get(dataStyle) : undefined;
  if (code && code !== 'General') spec.numberFormat = code;
  return spec;
}

function parseDuration(raw: string): number | undefined {
  const m = raw.match(/^-?P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/);
  if (!m) return undefined;
  const seconds = Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  return (raw.startsWith('-') ? -seconds : seconds) / 86400;
}

/** Elements annexes collectes pendant la lecture d'une feuille. */
interface SheetAcc {
  validationRuns: Map<string, CellRange[]>;
  mapRuns: Map<string, { conditions: { condition: string; style: string }[]; runs: CellRange[] }>;
  frames: OdsFrame[];
}

interface ReadContext {
  wb: Workbook;
  styles: OdsStyles;
  styleIds: Map<string, number>;
  acc: SheetAcc;
  validations: Map<string, Omit<DataValidation, 'ranges'>>;
  dxfIds: Map<string, number>;
}

const newAcc = (): SheetAcc => ({ validationRuns: new Map(), mapRuns: new Map(), frames: [] });

/** Format differentiel (index dans styles.dxfs) d'un style de cellule applique par une condition. */
function dxfOf(ctx: ReadContext, style: string): number | undefined {
  const cached = ctx.dxfIds.get(style);
  if (cached !== undefined) return cached;
  const spec = ctx.styles.cells.get(style);
  if (!spec || (!spec.font && !spec.fill)) return undefined;
  ctx.wb.styles.dxfs.push({ ...(spec.font ? { font: spec.font } : {}), ...(spec.fill ? { fill: spec.fill } : {}) });
  const id = ctx.wb.styles.dxfs.length - 1;
  ctx.dxfIds.set(style, id);
  return id;
}

function styleId(ctx: ReadContext, name: string | undefined): number | undefined {
  if (!name) return undefined;
  const cached = ctx.styleIds.get(name);
  if (cached !== undefined) return cached || undefined;
  const spec = ctx.styles.cells.get(name);
  const id = spec && Object.keys(spec).length ? styleIdFor(ctx.wb, spec) : 0;
  ctx.styleIds.set(name, id);
  return id || undefined;
}

function readCell(node: XmlElement, ctx: ReadContext, columnStyle: string | undefined): Cell | undefined {
  const type = node.attrs['office:value-type'] ?? node.attrs['calcext:value-type'];
  const formula = node.attrs['table:formula'];
  const style = styleId(ctx, node.attrs['table:style-name'] ?? columnStyle);
  let value: Cell['value'] = null;
  switch (type) {
    case 'float':
    case 'percentage':
    case 'currency':
      value = Number(node.attrs['office:value'] ?? Number.NaN);
      if (!Number.isFinite(value)) value = null;
      break;
    case 'date': {
      const raw = node.attrs['office:date-value'] ?? '';
      const time = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}${raw.includes('T') ? '' : 'T00:00:00'}Z`);
      value = Number.isFinite(time) ? dateToSerial(new Date(time), ctx.wb.date1904) : null;
      break;
    }
    case 'time':
      value = parseDuration(node.attrs['office:time-value'] ?? '') ?? null;
      break;
    case 'boolean':
      value = node.attrs['office:boolean-value'] === 'true';
      break;
    case 'string':
      value = node.attrs['office:string-value'] ?? cellText(node);
      break;
    default:
      if (kid(node, 'p')) value = cellText(node);
      if (node.attrs['calcext:value-type'] === 'error' && typeof value === 'string') value = parseErrorCode(value) ?? value;
  }
  if (value === null && formula === undefined && style === undefined) return undefined;
  const cell: Cell = { value };
  if (formula) cell.formula = odfToExcelFormula(formula);
  if (style) cell.styleId = style;
  if (type === 'string' && typeof value === 'string' && node.children.some((c) => isElement(c) && localName(c.name) === 'p')) {
    const content = paragraphRuns(kids(node, 'p'), ctx.styles.text);
    if (content.rich && content.text === value) cell.rich = content.rich;
  }
  return cell;
}

function readTable(table: XmlElement, sheet: Sheet, ctx: ReadContext): void {
  const columnStyles: (string | undefined)[] = [];
  let col = 0;
  const visitColumns = (parent: XmlElement): void => {
    for (const node of kids(parent)) {
      const name = localName(node.name);
      if (name === 'table-column') {
        const repeat = Math.min(Number(node.attrs['table:number-columns-repeated'] ?? 1) || 1, MAX_COLS - col);
        const widthPt = ctx.styles.columns.get(node.attrs['table:style-name'] ?? '')?.widthPt;
        const hidden = node.attrs['table:visibility'] === 'collapse';
        if (repeat > 0 && col < MAX_COLS && (widthPt !== undefined || hidden) && repeat < 1024) {
          sheet.cols.push({ min: col, max: col + repeat - 1, ...(widthPt !== undefined ? { width: ptToColWidth(widthPt) } : {}), ...(hidden ? { hidden: true } : {}) });
        }
        const defaultStyle = node.attrs['table:default-cell-style-name'];
        if (defaultStyle && defaultStyle !== 'Default' && repeat < 1024) for (let i = 0; i < repeat; i++) columnStyles[col + i] = defaultStyle;
        col += repeat;
      } else if (name === 'table-columns' || name === 'table-header-columns' || name === 'table-column-group') {
        visitColumns(node);
      }
    }
  };
  visitColumns(table);
  let row = 0;
  const visitRows = (parent: XmlElement): void => {
    for (const node of kids(parent)) {
      if (row >= MAX_ROWS) return;
      const name = localName(node.name);
      if (name === 'table-rows' || name === 'table-header-rows' || name === 'table-row-group') {
        visitRows(node);
        continue;
      }
      if (name !== 'table-row') continue;
      const repeat = Math.min(Number(node.attrs['table:number-rows-repeated'] ?? 1) || 1, MAX_ROWS - row);
      const heightPt = ctx.styles.rows.get(node.attrs['table:style-name'] ?? '')?.heightPt;
      const hidden = node.attrs['table:visibility'] === 'collapse' || node.attrs['table:visibility'] === 'filter';
      const cells = readRowCells(node, ctx, columnStyles, sheet, row, repeat);
      const hasContent = cells.size > 0;
      if (hasContent || heightPt !== undefined || hidden) {
        const copies = hasContent || repeat < 1024 ? repeat : 0;
        for (let i = 0; i < copies; i++) {
          if (hasContent) sheet.cells.set(row + i, i === 0 ? cells : new Map([...cells].map(([c, cell]) => [c, { ...cell }])));
          if (heightPt !== undefined || hidden) sheet.rows.set(row + i, { ...(heightPt !== undefined ? { height: Math.round(heightPt * 100) / 100 } : {}), ...(hidden ? { hidden: true } : {}) });
        }
      }
      row += repeat;
    }
  };
  visitRows(table);
}

function readRowCells(rowNode: XmlElement, ctx: ReadContext, columnStyles: (string | undefined)[], sheet: Sheet, row: number, rowRepeat: number): Map<number, Cell> {
  const line = new Map<number, Cell>();
  let col = 0;
  for (const node of kids(rowNode)) {
    const name = localName(node.name);
    if (name !== 'table-cell' && name !== 'covered-table-cell') continue;
    const repeat = Math.min(Number(node.attrs['table:number-columns-repeated'] ?? 1) || 1, MAX_COLS - col);
    if (repeat <= 0) break;
    const cell = name === 'table-cell' ? readCell(node, ctx, columnStyles[col]) : undefined;
    if (name === 'table-cell') collectCellExtras(node, ctx, sheet, row, col, repeat, rowRepeat, columnStyles[col]);
    if (cell && (cell.value !== null || cell.formula !== undefined || repeat < 1024)) {
      for (let i = 0; i < repeat; i++) line.set(col + i, i === 0 ? cell : { ...cell });
    }
    const spanCols = Number(node.attrs['table:number-columns-spanned'] ?? 1);
    const spanRows = Number(node.attrs['table:number-rows-spanned'] ?? 1);
    if (name === 'table-cell' && (spanCols > 1 || spanRows > 1)) {
      sheet.merges.push({ r1: row, c1: col, r2: Math.min(row + spanRows - 1, MAX_ROWS - 1), c2: Math.min(col + spanCols - 1, MAX_COLS - 1) });
    }
    col += repeat;
  }
  return line;
}

/** Commentaire, validation, conditions de style et objets d'une cellule. */
function collectCellExtras(node: XmlElement, ctx: ReadContext, sheet: Sheet, row: number, col: number, repeat: number, rowRepeat: number, columnStyle: string | undefined): void {
  const run: CellRange = { r1: row, r2: Math.min(row + rowRepeat - 1, MAX_ROWS - 1), c1: col, c2: Math.min(col + repeat - 1, MAX_COLS - 1) };
  const validation = node.attrs['table:content-validation-name'];
  if (validation && ctx.validations.has(validation)) {
    const list = ctx.acc.validationRuns.get(validation) ?? [];
    list.push(run);
    ctx.acc.validationRuns.set(validation, list);
  }
  const styleName = node.attrs['table:style-name'] ?? columnStyle;
  const maps = styleName ? ctx.styles.maps.get(styleName) : undefined;
  if (styleName && maps) {
    const entry = ctx.acc.mapRuns.get(styleName) ?? { conditions: maps, runs: [] };
    entry.runs.push(run);
    ctx.acc.mapRuns.set(styleName, entry);
  }
  for (const child of node.children) {
    if (!isElement(child)) continue;
    const name = localName(child.name);
    if (name === 'annotation' && sheet.notes.length < 50_000) sheet.notes.push(readAnnotation(child, { row, col }, ctx.styles.text));
    else if (name === 'frame' && isFrame(child)) {
      const frame = readFrame(child);
      if (frame) ctx.acc.frames.push(frame);
    }
  }
}

function readNamedRanges(body: XmlElement | undefined, wb: Workbook): void {
  for (const node of kids(kid(body, 'named-expressions'))) {
    const name = str(node, 'table:name');
    const address = str(node, 'table:cell-range-address') ?? str(node, 'table:expression');
    if (!name || !address) continue;
    const formula = localName(node.name) === 'named-range'
      ? address.split(/[;,\s]+/).filter(Boolean).map((part) => odfToExcelFormula(`[${part}]`)).join(',')
      : odfToExcelFormula(address);
    wb.definedNames.push({ name, formula });
  }
}

async function readMeta(pkg: OpcPackage, wb: Workbook): Promise<void> {
  if (!pkg.has('meta.xml')) return;
  const meta = kid(await pkg.readXml('meta.xml'), 'meta');
  const title = textOf(kid(meta, 'title'));
  if (title) wb.properties.title = title;
  const creator = textOf(kid(meta, 'initial-creator')) || textOf(kid(meta, 'creator'));
  if (creator) wb.properties.creator = creator;
  const subject = textOf(kid(meta, 'subject'));
  if (subject) wb.properties.subject = subject;
  const description = textOf(kid(meta, 'description'));
  if (description) wb.properties.description = description;
  const created = textOf(kid(meta, 'creation-date'));
  if (created) wb.properties.created = created;
}

/** Validations, mises en forme conditionnelles et graphiques collectes pendant la lecture d'une feuille. */
async function finishSheet(pkg: OpcPackage, table: XmlElement, sheet: Sheet, ctx: ReadContext): Promise<void> {
  for (const [name, runs] of ctx.acc.validationRuns) {
    const def = ctx.validations.get(name);
    if (def) sheet.dataValidations.push({ ...def, ranges: mergeRuns(runs) });
  }
  const lookup = (style: string): number | undefined => dxfOf(ctx, style);
  sheet.conditionalFormats.push(...conditionalFromStyleMaps(ctx.acc.mapRuns, lookup), ...readConditionalFormats(table, lookup));
  await readFrameCharts(pkg, sheet, ctx.acc.frames);
}

export async function readOds(bytes: Uint8Array): Promise<Workbook> {
  let pkg: OpcPackage;
  try {
    pkg = await OpcPackage.open(bytes);
  } catch (error) {
    if (error instanceof PackageError || error instanceof XmlError) throw new SpreadsheetError(strings.zipInvalid);
    throw error;
  }
  try {
    if (!pkg.has('content.xml')) throw new SpreadsheetError(strings.odsInvalid);
    const content = await pkg.readXml('content.xml');
    const stylesRoot = pkg.has('styles.xml') ? await pkg.readXml('styles.xml') : undefined;
    const ctx: ReadContext = {
      wb: createBlankWorkbook(), styles: readStyles(stylesRoot ? [stylesRoot, content] : [content]), styleIds: new Map(),
      acc: newAcc(), validations: new Map(), dxfIds: new Map(),
    };
    const wb = ctx.wb;
    wb.sheets = [];
    wb.sourceFormat = 'ods';
    wb.properties = {};
    const body = kid(kid(content, 'body'), 'spreadsheet');
    ctx.validations = readValidations(body);
    for (const table of kids(body, 'table')) {
      const sheet = createSheet(uniqueSheetName(wb, str(table, 'table:name') ?? `${strings.sheetPrefix}${wb.sheets.length + 1}`));
      const tableStyle = ctx.styles.tables.get(str(table, 'table:style-name') ?? '');
      if (tableStyle?.hidden) sheet.state = 'hidden';
      if (tableStyle?.tabColor) sheet.tabColor = { rgb: tableStyle.tabColor };
      wb.sheets.push(sheet);
      ctx.acc = newAcc();
      readTable(table, sheet, ctx);
      await finishSheet(pkg, table, sheet, ctx);
    }
    if (pkg.has('settings.xml')) applySettings(await pkg.readXml('settings.xml'), wb);
    if (wb.sheets.length === 0) throw new SpreadsheetError(strings.noSheets);
    readNamedRanges(body, wb);
    await readMeta(pkg, wb);
    const first = wb.sheets.findIndex((s) => s.state === 'visible');
    wb.activeSheet = Math.max(0, first);
    return wb;
  } catch (error) {
    if (error instanceof XmlError || error instanceof PackageError) throw new SpreadsheetError(`${strings.odsInvalid} (${error.message})`);
    throw error;
  }
}
