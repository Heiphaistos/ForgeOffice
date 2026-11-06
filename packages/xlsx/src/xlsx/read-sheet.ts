// Lecture d'une partie worksheet : cellules, lignes, colonnes, vues, fusions, liens, impression, protection.
import { isElement, parseXml, textOf, type Relationship, type XmlElement } from '@forgeoffice/opc';
import { parseCell, parseRange, parseSqref } from '../address.ts';
import type {
  Cell, CellError, ErrorCode, HeaderFooter, PasswordHash, RichRun, RowInfo, Sheet, SheetProtection, SheetView,
} from '../model.ts';
import { dateToSerial, parseErrorCode } from '../workbook.ts';
import { fromFileFormula } from './formula-names.ts';
import { readColor, readFontPartial } from './style-xml.ts';
import { bool, int, kid, kids, localName, num, optBool, relAttr, str } from './xml-util.ts';
import { readSheetRules } from './read-sheet-rules.ts';
import { scanSheetData, splitSheetData } from './read-sheet-data.ts';

export interface SharedString {
  text: string;
  rich?: RichRun[];
}

/** Texte d'un element « si » ou « is » : texte simple ou segments enrichis (phonetique ignoree). */
export function readRichText(node: XmlElement | undefined): SharedString {
  if (!node) return { text: '' };
  const runs = kids(node, 'r');
  if (runs.length === 0) return { text: textOf(kid(node, 't')) };
  const rich: RichRun[] = runs.map((r) => {
    const run: RichRun = { text: textOf(kid(r, 't')) };
    const props = kid(r, 'rPr');
    if (props) run.font = readFontPartial(props);
    return run;
  });
  return { text: rich.map((r) => r.text).join(''), rich };
}

export function readSharedStrings(root: XmlElement | undefined): SharedString[] {
  return kids(root, 'si').map(readRichText);
}

/** Liens vers les autres parties de la feuille (resolus par l'appelant). */
export interface SheetLinks {
  drawing?: string;
  legacyDrawing?: string;
  tables: string[];
}

export interface SheetReadContext {
  sst: SharedString[];
  date1904: boolean;
  rels: Relationship[];
}

const SAFE_URL = /^(https?:|mailto:|ftp:|file:|tel:|news:)/i;

function readCellElement(c: XmlElement, ctx: SheetReadContext): Cell {
  const type = c.attrs['t'] ?? 'n';
  let vNode: XmlElement | undefined;
  let fNode: XmlElement | undefined;
  let isNode: XmlElement | undefined;
  for (const node of c.children) {
    if (!isElement(node)) continue;
    const name = node.name.length === 1 ? node.name : localName(node.name);
    if (name === 'v') vNode = node;
    else if (name === 'f') fNode = node;
    else if (name === 'is') isNode = node;
  }
  const raw = vNode ? textOf(vNode) : undefined;
  const cell: Cell = { value: null };
  switch (type) {
    case 's': {
      const entry = raw === undefined ? undefined : ctx.sst[Number(raw)];
      if (entry) {
        cell.value = entry.text;
        if (entry.rich) cell.rich = entry.rich;
      } else if (raw !== undefined) {
        cell.value = '';
      }
      break;
    }
    case 'str':
      cell.value = raw ?? '';
      break;
    case 'inlineStr': {
      const entry = readRichText(isNode);
      cell.value = entry.text;
      if (entry.rich) cell.rich = entry.rich;
      break;
    }
    case 'b':
      cell.value = raw === undefined ? null : raw === '1' || raw === 'true';
      break;
    case 'e':
      cell.value = raw === undefined ? null : (parseErrorCode(raw) ?? ({ error: '#VALUE!' as ErrorCode } satisfies CellError));
      break;
    case 'd': {
      const time = raw === undefined ? Number.NaN : Date.parse(raw.endsWith('Z') || /[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
      cell.value = Number.isFinite(time) ? dateToSerial(new Date(time), ctx.date1904) : null;
      break;
    }
    default: {
      if (raw !== undefined && raw !== '') {
        const n = Number(raw);
        cell.value = Number.isFinite(n) ? n : raw;
      }
    }
  }
  const s = c.attrs['s'];
  if (s !== undefined && s !== '0') {
    const styleId = Number(s);
    if (Number.isInteger(styleId) && styleId > 0) cell.styleId = styleId;
  }
  if (fNode) readFormula(fNode, cell, c);
  return cell;
}

function readFormula(f: XmlElement, cell: Cell, c: XmlElement): void {
  const text = textOf(f);
  const kind = f.attrs['t'];
  if (kind === 'shared') {
    const index = Number(f.attrs['si'] ?? '0');
    const ref = f.attrs['ref'] ? parseRange(f.attrs['ref']) : undefined;
    cell.shared = ref ? { index, ref } : { index };
    if (text) cell.formula = fromFileFormula(text);
    return;
  }
  if (kind === 'dataTable') return;
  if (text) cell.formula = fromFileFormula(text);
  if (kind === 'array') {
    const ref = (f.attrs['ref'] ? parseRange(f.attrs['ref']) : undefined) ?? parseRange(c.attrs['r'] ?? 'A1');
    if (ref) cell.array = c.attrs['cm'] ? { ref, dynamic: true } : { ref };
  }
}

/** Lit une ligne (element « row ») ; `state.row` suit l'index implicite des lignes sans « r ». */
function readRow(rowNode: XmlElement, sheet: Sheet, ctx: SheetReadContext, state: { row: number }): void {
  const r = rowNode.attrs['r'];
  const rowIndex = r ? Number(r) - 1 : state.row + 1;
  state.row = rowIndex;
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= 1_048_576) return;
  readRowInfo(rowNode, rowIndex, sheet);
  let line: Map<number, Cell> | undefined;
  let colIndex = -1;
  for (const c of rowNode.children) {
    if (!isElement(c) || (c.name !== 'c' && localName(c.name) !== 'c')) continue;
    const ref = c.attrs['r'];
    const address = ref ? parseCell(ref) : undefined;
    colIndex = address ? address.col : colIndex + 1;
    if (colIndex >= 16_384) continue;
    if (!line) {
      line = sheet.cells.get(rowIndex) ?? new Map<number, Cell>();
      sheet.cells.set(rowIndex, line);
    }
    line.set(colIndex, readCellElement(c, ctx));
  }
}

function readRowInfo(node: XmlElement, row: number, sheet: Sheet): void {
  const info: RowInfo = {};
  const height = num(node, 'ht');
  if (height !== undefined && (optBool(node, 'customHeight') || Math.abs(height - sheet.defaultRowHeight) > 0.01)) info.height = height;
  if (optBool(node, 'hidden')) info.hidden = true;
  if (optBool(node, 'customFormat')) {
    const s = int(node, 's');
    if (s) info.styleId = s;
  }
  const level = int(node, 'outlineLevel');
  if (level) info.outlineLevel = level;
  if (optBool(node, 'collapsed')) info.collapsed = true;
  if (optBool(node, 'thickTop')) info.thickTop = true;
  if (optBool(node, 'thickBot')) info.thickBottom = true;
  if (Object.keys(info).length) sheet.rows.set(row, info);
}

function readView(node: XmlElement | undefined, sheet: Sheet): void {
  if (!node) return;
  const view: SheetView = sheet.view;
  view.showGridLines = bool(node, 'showGridLines', true);
  view.showHeaders = bool(node, 'showRowColHeaders', true);
  view.showZeros = bool(node, 'showZeros', true);
  if (optBool(node, 'showFormulas')) view.showFormulas = true;
  if (optBool(node, 'rightToLeft')) view.rightToLeft = true;
  if (optBool(node, 'tabSelected')) view.tabSelected = true;
  const zoom = int(node, 'zoomScale');
  if (zoom) view.zoom = Math.min(400, Math.max(10, zoom));
  const mode = str(node, 'view');
  if (mode === 'pageBreakPreview' || mode === 'pageLayout') view.view = mode;
  const topLeft = parseCell(str(node, 'topLeftCell') ?? '');
  if (topLeft) view.topLeftCell = topLeft;
  const gridColor = int(node, 'colorId');
  if (gridColor !== undefined && optBool(node, 'defaultGridColor') === false) view.gridColor = { indexed: gridColor };
  const pane = kid(node, 'pane');
  if (pane) {
    const x = num(pane, 'xSplit') ?? 0;
    const y = num(pane, 'ySplit') ?? 0;
    const state = str(pane, 'state') ?? 'split';
    if (state === 'frozen' || state === 'frozenSplit') view.frozen = { rows: Math.round(y), cols: Math.round(x) };
    else if (x || y) view.split = { x, y };
  }
  const selections = kids(node, 'selection');
  const selection = selections[selections.length - 1];
  if (selection) {
    const active = parseCell(str(selection, 'activeCell') ?? '');
    if (active) view.activeCell = active;
    const ranges = parseSqref(str(selection, 'sqref') ?? '');
    if (ranges.length) view.selection = ranges;
  }
}

function readColumns(cols: XmlElement | undefined, sheet: Sheet): void {
  for (const node of kids(cols, 'col')) {
    const min = (int(node, 'min') ?? 1) - 1;
    const max = Math.min((int(node, 'max') ?? min + 1) - 1, 16_383);
    if (min < 0 || max < min) continue;
    const col: Sheet['cols'][number] = { min, max };
    const width = num(node, 'width');
    if (width !== undefined) col.width = width;
    if (optBool(node, 'hidden')) col.hidden = true;
    const style = int(node, 'style');
    if (style) col.styleId = style;
    const level = int(node, 'outlineLevel');
    if (level) col.outlineLevel = level;
    if (optBool(node, 'collapsed')) col.collapsed = true;
    if (optBool(node, 'bestFit')) col.bestFit = true;
    sheet.cols.push(col);
  }
}

export function readPasswordHash(node: XmlElement | undefined): PasswordHash | undefined {
  if (!node) return undefined;
  const hash: PasswordHash = {};
  const legacy = str(node, 'password') ?? str(node, 'workbookPassword');
  if (legacy) hash.legacy = legacy;
  const algorithm = str(node, 'algorithmName') ?? str(node, 'workbookAlgorithmName');
  if (algorithm) hash.algorithmName = algorithm;
  const value = str(node, 'hashValue') ?? str(node, 'workbookHashValue');
  if (value) hash.hashValue = value;
  const salt = str(node, 'saltValue') ?? str(node, 'workbookSaltValue');
  if (salt) hash.saltValue = salt;
  const spin = int(node, 'spinCount') ?? int(node, 'workbookSpinCount');
  if (spin !== undefined) hash.spinCount = spin;
  return Object.keys(hash).length ? hash : undefined;
}

function readProtection(node: XmlElement | undefined): SheetProtection | undefined {
  if (!node) return undefined;
  const protection: SheetProtection = { sheet: bool(node, 'sheet', false), allow: {} };
  const password = readPasswordHash(node);
  if (password) protection.password = password;
  if (optBool(node, 'objects')) protection.objects = true;
  if (optBool(node, 'scenarios')) protection.scenarios = true;
  // Attributs OOXML a vrai = action INTERDITE ; defauts : interdites sauf selection.
  const flags = ['formatCells', 'formatColumns', 'formatRows', 'insertColumns', 'insertRows', 'insertHyperlinks', 'deleteColumns',
    'deleteRows', 'sort', 'autoFilter', 'pivotTables'] as const;
  for (const key of flags) protection.allow[key] = !bool(node, key, true);
  protection.allow.selectLockedCells = !bool(node, 'selectLockedCells', false);
  protection.allow.selectUnlockedCells = !bool(node, 'selectUnlockedCells', false);
  return protection;
}

function readPrint(root: XmlElement, sheet: Sheet): void {
  const setup = sheet.pageSetup;
  const options = kid(root, 'printOptions');
  if (optBool(options, 'gridLines')) setup.printGridLines = true;
  if (optBool(options, 'headings')) setup.printHeadings = true;
  if (optBool(options, 'horizontalCentered')) setup.horizontalCentered = true;
  if (optBool(options, 'verticalCentered')) setup.verticalCentered = true;
  const margins = kid(root, 'pageMargins');
  if (margins) {
    for (const key of ['left', 'right', 'top', 'bottom', 'header', 'footer'] as const) {
      const value = num(margins, key);
      if (value !== undefined) setup.margins[key] = value;
    }
  }
  const page = kid(root, 'pageSetup');
  if (page) {
    const orientation = str(page, 'orientation');
    if (orientation === 'portrait' || orientation === 'landscape') setup.orientation = orientation;
    const paper = int(page, 'paperSize');
    if (paper !== undefined) setup.paperSize = paper;
    const scale = int(page, 'scale');
    if (scale !== undefined) setup.scale = scale;
    const fw = int(page, 'fitToWidth');
    if (fw !== undefined) setup.fitToWidth = fw;
    const fh = int(page, 'fitToHeight');
    if (fh !== undefined) setup.fitToHeight = fh;
    if (optBool(page, 'useFirstPageNumber')) setup.firstPageNumber = int(page, 'firstPageNumber') ?? 1;
    const dpi = int(page, 'horizontalDpi');
    if (dpi !== undefined) setup.dpi = dpi;
    const order = str(page, 'pageOrder');
    if (order === 'overThenDown' || order === 'downThenOver') setup.pageOrder = order;
    if (optBool(page, 'blackAndWhite')) setup.blackAndWhite = true;
    if (optBool(page, 'draft')) setup.draft = true;
    const comments = str(page, 'cellComments');
    if (comments === 'asDisplayed' || comments === 'atEnd') setup.cellComments = comments;
    const errors = str(page, 'errors');
    if (errors === 'blank' || errors === 'dash' || errors === 'NA') setup.errors = errors;
  }
  const hf = kid(root, 'headerFooter');
  if (hf) {
    const headerFooter: HeaderFooter = {};
    for (const key of ['oddHeader', 'oddFooter', 'evenHeader', 'evenFooter', 'firstHeader', 'firstFooter'] as const) {
      const node = kid(hf, key);
      if (node) headerFooter[key] = textOf(node);
    }
    if (optBool(hf, 'differentOddEven')) headerFooter.differentOddEven = true;
    if (optBool(hf, 'differentFirst')) headerFooter.differentFirst = true;
    if (optBool(hf, 'scaleWithDoc') === false) headerFooter.scaleWithDoc = false;
    if (optBool(hf, 'alignWithMargins') === false) headerFooter.alignWithMargins = false;
    setup.headerFooter = headerFooter;
  }
  setup.rowBreaks = kids(kid(root, 'rowBreaks'), 'brk').map((b) => (int(b, 'id') ?? 1) - 1).filter((n) => n >= 0);
  setup.colBreaks = kids(kid(root, 'colBreaks'), 'brk').map((b) => (int(b, 'id') ?? 1) - 1).filter((n) => n >= 0);
}

function readHyperlinks(root: XmlElement, sheet: Sheet, rels: Relationship[]): void {
  for (const node of kids(kid(root, 'hyperlinks'), 'hyperlink')) {
    const ref = parseRange(str(node, 'ref') ?? '');
    if (!ref) continue;
    const link: Sheet['hyperlinks'][number] = { ref };
    const rid = relAttr(node);
    if (rid) {
      const rel = rels.find((r) => r.id === rid);
      if (rel && SAFE_URL.test(rel.target)) link.target = rel.target;
      else if (rel && rel.external && !/^[a-z][a-z0-9+.-]*:/i.test(rel.target)) link.target = rel.target;
    }
    const location = str(node, 'location');
    if (location) link.location = location;
    const tooltip = str(node, 'tooltip');
    if (tooltip) link.tooltip = tooltip;
    const display = str(node, 'display');
    if (display) link.display = display;
    if (link.target || link.location) sheet.hyperlinks.push(link);
  }
}

/** Remplit `sheet` depuis le XML « worksheet » et renvoie les liens vers les parties annexes. */
export function readWorksheet(xml: string, sheet: Sheet, ctx: SheetReadContext): SheetLinks {
  const split = splitSheetData(xml);
  const root = parseXml(split ? split.rest : xml);
  const pr = kid(root, 'sheetPr');
  if (pr) {
    const tab = readColor(kid(pr, 'tabColor'));
    if (tab) sheet.tabColor = tab;
    const code = str(pr, 'codeName');
    if (code) sheet.codeName = code;
    const outline = kid(pr, 'outlinePr');
    if (outline) {
      sheet.outline.summaryBelow = bool(outline, 'summaryBelow', true);
      sheet.outline.summaryRight = bool(outline, 'summaryRight', true);
      sheet.outline.showSymbols = bool(outline, 'showOutlineSymbols', true);
    }
    if (optBool(kid(pr, 'pageSetUpPr'), 'fitToPage')) sheet.pageSetup.fitToPage = true;
  }
  const format = kid(root, 'sheetFormatPr');
  if (format) {
    sheet.defaultRowHeight = num(format, 'defaultRowHeight') ?? sheet.defaultRowHeight;
    const width = num(format, 'defaultColWidth');
    if (width !== undefined) sheet.defaultColWidth = width;
    const base = int(format, 'baseColWidth');
    if (base !== undefined) sheet.baseColWidth = base;
  }
  readView(kid(kid(root, 'sheetViews'), 'sheetView'), sheet);
  readColumns(kid(root, 'cols'), sheet);
  const state = { row: -1 };
  if (split) scanSheetData(xml, split.start, split.end, (row) => readRow(row, sheet, ctx, state));
  else for (const row of kids(kid(root, 'sheetData'), 'row')) readRow(row, sheet, ctx, state);
  const protection = readProtection(kid(root, 'sheetProtection'));
  if (protection) sheet.protection = protection;
  for (const node of kids(kid(root, 'protectedRanges'), 'protectedRange')) {
    const item: Sheet['protectedRanges'][number] = { name: str(node, 'name') ?? '', ranges: parseSqref(str(node, 'sqref') ?? '') };
    const password = readPasswordHash(node);
    if (password) item.password = password;
    sheet.protectedRanges.push(item);
  }
  for (const node of kids(kid(root, 'mergeCells'), 'mergeCell')) {
    const range = parseRange(str(node, 'ref') ?? '');
    if (range && (range.r1 !== range.r2 || range.c1 !== range.c2)) sheet.merges.push(range);
  }
  readSheetRules(root, sheet);
  readHyperlinks(root, sheet, ctx.rels);
  readPrint(root, sheet);
  const links: SheetLinks = { tables: [] };
  const drawing = relAttr(kid(root, 'drawing'));
  if (drawing) links.drawing = drawing;
  const legacy = relAttr(kid(root, 'legacyDrawing'));
  if (legacy) links.legacyDrawing = legacy;
  for (const part of kids(kid(root, 'tableParts'), 'tablePart')) {
    const rid = relAttr(part);
    if (rid) links.tables.push(rid);
  }
  return links;
}
