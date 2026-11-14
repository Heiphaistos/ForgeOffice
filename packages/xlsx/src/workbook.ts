// Fabrique et manipulation du modele : classeur vierge, feuilles, cellules, styles internes, dates.
import { BUILTIN_NUMBER_FORMATS, DEFAULT_INDEXED_COLORS, ERROR_CODES, FIRST_CUSTOM_NUMFMT_ID, officeTheme, THEME_COLOR_ORDER } from './constants.ts';
import type {
  Alignment, Border, Cell, CellError, CellFormat, Color, CellRange, CellValue, ErrorCode, Fill, Font, PageSetup, Protection,
  Sheet, SheetView, Styles, Workbook,
} from './model.ts';

/** Police par defaut d'Office 2024 (corps du theme : Aptos Narrow 11, repli Calibri a l'affichage). */
export function defaultFont(): Font {
  return { name: 'Aptos Narrow', size: 11, color: { theme: 1 }, family: 2, scheme: 'minor' };
}

export function defaultStyles(font: Font = defaultFont()): Styles {
  return {
    numFmts: [],
    fonts: [font],
    fills: [{ type: 'pattern', pattern: 'none' }, { type: 'pattern', pattern: 'gray125' }],
    borders: [{}],
    cellStyleXfs: [{ numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 }],
    cellXfs: [{ numFmtId: 0, fontId: 0, fillId: 0, borderId: 0, xfId: 0 }],
    cellStyles: [{ name: 'Normal', xfId: 0, builtinId: 0 }],
    dxfs: [],
    tableStyles: [],
    defaultTableStyle: 'TableStyleMedium2',
    defaultPivotStyle: 'PivotStyleLight16',
  };
}

export function defaultSheetView(): SheetView {
  return { zoom: 100, view: 'normal', showGridLines: true, showHeaders: true, showZeros: true };
}

export function defaultPageSetup(): PageSetup {
  return {
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    rowBreaks: [],
    colBreaks: [],
  };
}

/** Feuille vide aux reglages Office 2024. */
export function createSheet(name: string): Sheet {
  return {
    name,
    state: 'visible',
    cells: new Map(),
    defaultRowHeight: 14.4,
    cols: [],
    rows: new Map(),
    outline: { summaryBelow: true, summaryRight: true, showSymbols: true },
    merges: [],
    view: defaultSheetView(),
    conditionalFormats: [],
    dataValidations: [],
    tables: [],
    hyperlinks: [],
    notes: [],
    threadedComments: [],
    drawings: [],
    sparklineGroups: [],
    pageSetup: defaultPageSetup(),
    protectedRanges: [],
  };
}

/** Classeur vierge Office 2024 : theme Aptos, police Aptos Narrow 11, une feuille « Feuil1 ». */
export function createBlankWorkbook(profile?: 'onlyoffice'): Workbook {
  const sheet = createSheet('Feuil1');
  sheet.view.tabSelected = true;
  // Profil OnlyOffice : un classeur neuf d'OnlyOffice Desktop 10.0 est en Calibri 11.
  const oo = profile === 'onlyoffice';
  const theme = officeTheme();
  if (oo) { theme.majorFont = { latin: 'Calibri Light' }; theme.minorFont = { latin: 'Calibri' }; }
  return {
    properties: { application: 'ForgeOffice Tableur' },
    theme,
    styles: defaultStyles(oo ? { ...defaultFont(), name: 'Calibri' } : undefined),
    definedNames: [],
    sheets: [sheet],
    date1904: false,
    calc: { mode: 'auto', calcId: 191029 },
    activeSheet: 0,
    persons: [],
  };
}

/** Nom de feuille valide : 1..31 caracteres, sans « : \ / ? * [ ] », ni apostrophe en bordure. */
export function isValidSheetName(name: string): boolean {
  return name.length > 0 && name.length <= 31 && !/[:\\/?*[\]]/.test(name) && !name.startsWith("'") && !name.endsWith("'");
}

/** Rend un nom de feuille valide et unique dans le classeur (« Feuil1 (2) »). */
export function uniqueSheetName(wb: Workbook, wanted: string): string {
  let base = wanted.replace(/[:\\/?*[\]]/g, '_').replace(/^'+|'+$/g, '').slice(0, 31) || 'Feuil';
  const taken = new Set(wb.sheets.map((s) => s.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    base = base.slice(0, 31 - suffix.length);
    const candidate = base + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function addSheet(wb: Workbook, name?: string): Sheet {
  const sheet = createSheet(uniqueSheetName(wb, name ?? `Feuil${wb.sheets.length + 1}`));
  wb.sheets.push(sheet);
  return sheet;
}

export function findSheet(wb: Workbook, name: string): Sheet | undefined {
  const lower = name.toLowerCase();
  return wb.sheets.find((s) => s.name.toLowerCase() === lower);
}

// ---------------------------------------------------------------- Cellules

export function getCell(sheet: Sheet, row: number, col: number): Cell | undefined {
  return sheet.cells.get(row)?.get(col);
}

/** Place une cellule (remplace l'existante). */
export function putCell(sheet: Sheet, row: number, col: number, cell: Cell): Cell {
  let line = sheet.cells.get(row);
  if (!line) {
    line = new Map();
    sheet.cells.set(row, line);
  }
  line.set(col, cell);
  return cell;
}

/** Ecrit une valeur en gardant le style existant ; efface la formule. */
export function setValue(sheet: Sheet, row: number, col: number, value: CellValue): Cell {
  const previous = getCell(sheet, row, col);
  const cell: Cell = { value };
  if (previous?.styleId) cell.styleId = previous.styleId;
  return putCell(sheet, row, col, cell);
}

/** Ecrit une formule (sans « = ») avec une valeur en cache facultative. */
export function setFormula(sheet: Sheet, row: number, col: number, formula: string, cached: CellValue = null): Cell {
  const previous = getCell(sheet, row, col);
  const cell: Cell = { value: cached, formula: formula.startsWith('=') ? formula.slice(1) : formula };
  if (previous?.styleId) cell.styleId = previous.styleId;
  return putCell(sheet, row, col, cell);
}

export function deleteCell(sheet: Sheet, row: number, col: number): boolean {
  const line = sheet.cells.get(row);
  if (!line) return false;
  const removed = line.delete(col);
  if (line.size === 0) sheet.cells.delete(row);
  return removed;
}

/** Nombre de cellules stockees. */
export function cellCount(sheet: Sheet): number {
  let n = 0;
  for (const line of sheet.cells.values()) n += line.size;
  return n;
}

/** Parcourt les cellules ligne par ligne, colonnes croissantes. */
export function* iterateCells(sheet: Sheet): Generator<{ row: number; col: number; cell: Cell }> {
  const rows = [...sheet.cells.keys()].sort((a, b) => a - b);
  for (const row of rows) {
    const line = sheet.cells.get(row);
    if (!line) continue;
    const cols = [...line.keys()].sort((a, b) => a - b);
    for (const col of cols) {
      const cell = line.get(col);
      if (cell) yield { row, col, cell };
    }
  }
}

/** Plage utilisee (cellules stockees) ; undefined pour une feuille vide. */
export function usedRange(sheet: Sheet): CellRange | undefined {
  let r1 = Infinity;
  let c1 = Infinity;
  let r2 = -1;
  let c2 = -1;
  for (const [row, line] of sheet.cells) {
    if (line.size === 0) continue;
    if (row < r1) r1 = row;
    if (row > r2) r2 = row;
    for (const col of line.keys()) {
      if (col < c1) c1 = col;
      if (col > c2) c2 = col;
    }
  }
  return r2 < 0 ? undefined : { r1, c1, r2, c2 };
}

export function isCellError(value: CellValue | undefined): value is CellError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

const ERROR_SET: ReadonlySet<string> = new Set(ERROR_CODES);

/** « #DIV/0! » -> { error } ; undefined si le texte n'est pas un code d'erreur. */
export function parseErrorCode(text: string): CellError | undefined {
  const upper = text.trim().toUpperCase();
  return ERROR_SET.has(upper) ? { error: upper as ErrorCode } : undefined;
}

// ---------------------------------------------------------------- Styles internes (deduplication)

const tableCaches = new WeakMap<object, Map<string, number>>();

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        const item = (v as Record<string, unknown>)[k];
        if (item !== undefined) sorted[k] = item;
      }
      return sorted;
    }
    return v;
  });
}

/** Ajoute `item` a `table` sauf s'il y figure deja (comparaison structurelle) ; renvoie l'index. */
export function intern<T>(table: T[], item: T): number {
  let cache = tableCaches.get(table);
  if (!cache || cache.size > table.length) {
    cache = new Map();
    tableCaches.set(table, cache);
  }
  if (cache.size < table.length) {
    for (let i = 0; i < table.length; i++) {
      const key = stableKey(table[i]);
      if (!cache.has(key)) cache.set(key, i);
    }
  }
  const key = stableKey(item);
  const found = cache.get(key);
  if (found !== undefined && stableKey(table[found]) === key) return found;
  table.push(item);
  cache.set(key, table.length - 1);
  return table.length - 1;
}

/** Identifiant d'un code de format : integre si connu, sinon personnalise (cree au besoin). */
export function numberFormatId(styles: Styles, code: string): number {
  for (const [id, builtin] of Object.entries(BUILTIN_NUMBER_FORMATS)) if (builtin === code) return Number(id);
  const existing = styles.numFmts.find((f) => f.code === code);
  if (existing) return existing.id;
  const id = Math.max(FIRST_CUSTOM_NUMFMT_ID - 1, ...styles.numFmts.map((f) => f.id)) + 1;
  styles.numFmts.push({ id, code });
  return id;
}

/** Code d'un format de nombre (personnalise ou integre ; « General » si inconnu). */
export function numberFormatCode(styles: Styles, id: number): string {
  return styles.numFmts.find((f) => f.id === id)?.code ?? BUILTIN_NUMBER_FORMATS[id] ?? 'General';
}

export interface StyleSpec {
  font?: Partial<Font>;
  fill?: Fill;
  border?: Border;
  numberFormat?: string;
  alignment?: Alignment;
  protection?: Protection;
  /** Style nomme parent (index dans `cellStyleXfs`). */
  xfId?: number;
}

/** Index de format de cellule pour une specification (les tables sont completees sans doublon). */
export function styleIdFor(wb: Workbook, spec: StyleSpec, base = 0): number {
  const styles = wb.styles;
  const parent = styles.cellXfs[base] ?? styles.cellXfs[0] ?? { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 };
  const xf: CellFormat = { ...parent };
  if (spec.font) xf.fontId = intern(styles.fonts, { ...(styles.fonts[parent.fontId] ?? defaultFont()), ...spec.font });
  if (spec.fill) xf.fillId = intern(styles.fills, spec.fill);
  if (spec.border) xf.borderId = intern(styles.borders, spec.border);
  if (spec.numberFormat !== undefined) xf.numFmtId = numberFormatId(styles, spec.numberFormat);
  if (spec.alignment) xf.alignment = { ...parent.alignment, ...spec.alignment };
  if (spec.protection) xf.protection = { ...parent.protection, ...spec.protection };
  if (spec.xfId !== undefined) xf.xfId = spec.xfId;
  if (xf.xfId === undefined) xf.xfId = 0;
  return intern(styles.cellXfs, xf);
}

/** Police effective d'une cellule. */
export function cellFont(wb: Workbook, cell: Cell | undefined): Font {
  const xf = wb.styles.cellXfs[cell?.styleId ?? 0];
  return wb.styles.fonts[xf?.fontId ?? 0] ?? wb.styles.fonts[0] ?? defaultFont();
}

// ---------------------------------------------------------------- Dates

const MS_PER_DAY = 86_400_000;
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

/** Numero de serie Excel -> date UTC (le 29/02/1900 fictif du systeme 1900 donne le 28/02). */
export function serialToDate(serial: number, date1904 = false): Date {
  if (date1904) return new Date(EPOCH_1904 + Math.round(serial * MS_PER_DAY));
  const value = serial >= 60 ? serial : serial + 1;
  return new Date(EPOCH_1900 + Math.round(value * MS_PER_DAY));
}

/** Date UTC -> numero de serie Excel (fraction = heure). */
export function dateToSerial(date: Date, date1904 = false): number {
  const ms = date.getTime();
  if (date1904) return (ms - EPOCH_1904) / MS_PER_DAY;
  const serial = (ms - EPOCH_1900) / MS_PER_DAY;
  return serial < 61 ? serial - 1 : serial;
}

/** Vrai si le code de format affiche une date ou une heure (hors texte cite et couleurs). */
export function isDateFormatCode(code: string): boolean {
  const cleaned = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(?:\$[^\]]*|[a-z]+\d*|color\s*\d+|[<>=][^\]]*)\]/gi, '')
    .replace(/_.|\*./g, '');
  if (/^general$/i.test(cleaned.trim())) return false;
  return /[dmyhs]/i.test(cleaned.replace(/E[+-]/gi, '')) || /\[(h|m|s)+\]/i.test(code);
}

export function isDateFormatId(styles: Styles, numFmtId: number): boolean {
  if ((numFmtId >= 14 && numFmtId <= 22) || (numFmtId >= 45 && numFmtId <= 47)) return true;
  if (numFmtId < FIRST_CUSTOM_NUMFMT_ID && BUILTIN_NUMBER_FORMATS[numFmtId] === undefined) {
    // Formats locaux d'Asie (27..36, 50..58) : dates.
    return (numFmtId >= 27 && numFmtId <= 36) || (numFmtId >= 50 && numFmtId <= 58);
  }
  return isDateFormatCode(numberFormatCode(styles, numFmtId));
}

/** Vrai si la cellule affiche une date d'apres son format. */
export function isDateCell(wb: Workbook, cell: Cell | undefined): boolean {
  if (!cell || typeof cell.value !== 'number') return false;
  const xf = wb.styles.cellXfs[cell.styleId ?? 0];
  return xf ? isDateFormatId(wb.styles, xf.numFmtId) : false;
}

// ---------------------------------------------------------------- Couleurs

function applyTint(hex: string, tint: number): string {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor((h + 6) % 6);
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector] ?? [0, 0, 0];
  return [r1, g1, b1].map((v) => Math.round(((v ?? 0) + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Couleur Office -> « RRGGBB » (theme et teinte resolus) ; undefined = automatique. */
export function resolveColor(wb: Workbook, color: Color | undefined): string | undefined {
  if (!color || color.auto) return undefined;
  let hex: string | undefined;
  if (color.rgb) hex = color.rgb.slice(-6).toUpperCase();
  else if (color.theme !== undefined) hex = wb.theme.colors[THEME_COLOR_ORDER[color.theme] ?? 'dk1'];
  else if (color.indexed !== undefined) hex = DEFAULT_INDEXED_COLORS[color.indexed];
  if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return undefined;
  return color.tint ? applyTint(hex, color.tint) : hex.toUpperCase();
}
