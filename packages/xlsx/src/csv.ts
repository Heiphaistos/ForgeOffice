// CSV / TSV : detection d'encodage (BOM UTF-8/UTF-16, UTF-8 strict, sinon Windows-1252), du separateur
// (, ; tabulation |) et de la decimale francaise ; reconnaissance des nombres, pourcentages, booleens et dates.
import { MAX_COLS, MAX_ROWS, type Cell, type Sheet, type Workbook } from './model.ts';
import { SpreadsheetError, strings } from './strings.ts';
import {
  createBlankWorkbook, dateToSerial, isDateCell, isCellError, numberFormatCode, parseErrorCode, serialToDate, styleIdFor,
} from './workbook.ts';

export type CsvEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export interface CsvReadOptions {
  /** Separateur ; detecte si absent. */
  separator?: string;
  /** Separateur decimal ; detecte si absent (virgule si le separateur n'est pas la virgule et que des « 1,5 » apparaissent). */
  decimal?: ',' | '.';
  encoding?: CsvEncoding;
  /** Ordre des dates ambigues « 03/04/2024 » (defaut jour/mois/annee). */
  dateOrder?: 'DMY' | 'MDY';
  /** Reconnaitre nombres, dates, booleens (defaut vrai). Sinon tout reste texte. */
  detectTypes?: boolean;
  /** Interpreter « =... » comme formule (defaut faux : protection contre l'injection CSV). */
  formulas?: boolean;
  sheetName?: string;
}

export interface CsvInfo {
  encoding: CsvEncoding;
  bom: boolean;
  separator: string;
  decimal: ',' | '.';
}

const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';

// ---------------------------------------------------------------- Encodage

export function decodeText(bytes: Uint8Array, forced?: CsvEncoding): { text: string; encoding: CsvEncoding; bom: boolean } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8', bom: true };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le', bom: true };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be', bom: true };
  if (forced) return { text: decodeAs(bytes, forced), encoding: forced, bom: false };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8', bom: false };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { text: decodeAs(bytes, 'windows-1252'), encoding: 'windows-1252', bom: false };
  }
}

function decodeAs(bytes: Uint8Array, encoding: CsvEncoding): string {
  if (encoding !== 'windows-1252') return new TextDecoder(encoding).decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    out += Array.from(chunk, (b) => (b >= 0x80 && b <= 0x9f ? CP1252_HIGH.charAt(b - 0x80) : String.fromCharCode(b))).join('');
  }
  return out;
}

export function encodeText(text: string, encoding: CsvEncoding, bom: boolean): Uint8Array {
  if (encoding === 'utf-8') {
    const body = new TextEncoder().encode(text);
    if (!bom) return body;
    const out = new Uint8Array(body.length + 3);
    out.set([0xef, 0xbb, 0xbf]);
    out.set(body, 3);
    return out;
  }
  if (encoding === 'windows-1252') {
    const out = new Uint8Array(text.length);
    let n = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 63;
      const high = CP1252_HIGH.indexOf(ch);
      out[n++] = code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : high >= 0 ? 0x80 + high : 63;
    }
    return out.subarray(0, n);
  }
  const le = encoding === 'utf-16le';
  const out = new Uint8Array(text.length * 2 + (bom ? 2 : 0));
  let n = 0;
  if (bom) {
    out[n++] = le ? 0xff : 0xfe;
    out[n++] = le ? 0xfe : 0xff;
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[n++] = le ? code & 0xff : code >> 8;
    out[n++] = le ? code >> 8 : code & 0xff;
  }
  return out;
}

// ---------------------------------------------------------------- Analyse

/** Decoupe un texte CSV (RFC 4180 : guillemets doubles, retours a la ligne dans les champs). */
export function parseCsvRows(text: string, separator: string, maxRows = MAX_ROWS): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  const len = text.length;
  let quoted = false;
  while (i < len) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      quoted = true;
      field = '';
      i++;
    } else if (text.startsWith(separator, i)) {
      row.push(field);
      field = '';
      i += separator.length;
    } else if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      if (rows.length >= maxRows) return rows;
      row = [];
      field = '';
      i += ch === '\r' && text.charAt(i + 1) === '\n' ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Separateur le plus regulier sur les premieres lignes (hors guillemets). */
export function detectSeparator(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  const candidates = [';', ',', '\t', '|'];
  let best = ',';
  let bestScore = -1;
  for (const sep of candidates) {
    const rows = parseCsvRows(sample, sep, 30).filter((r) => r.length > 1 || r[0] !== '');
    if (rows.length === 0) continue;
    const counts = rows.map((r) => r.length);
    const first = counts[0] ?? 1;
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = consistent * 1000 + first;
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return best;
}

const NUMBER_FR = /^[+-]?(?:\d{1,3}(?:[   .]\d{3})+|\d+)(?:,\d+)?(?:[eE][+-]?\d+)?$/;
const NUMBER_EN = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const NUMBER_PLAIN = /^[+-]?(?:\d+[.,]?\d*|[.,]\d+)(?:[eE][+-]?\d+)?$/;

function detectDecimal(rows: string[][], separator: string): ',' | '.' {
  if (separator === ',') return '.';
  let comma = 0;
  let dot = 0;
  for (const row of rows.slice(0, 200)) {
    for (const field of row) {
      const v = field.trim();
      if (/^[+-]?\d+,\d+$/.test(v)) comma++;
      else if (/^[+-]?\d+\.\d+$/.test(v)) dot++;
    }
  }
  return comma >= dot && comma > 0 ? ',' : dot > 0 ? '.' : ',';
}

interface Parsed {
  value: Cell['value'];
  format?: string;
}

/** Nombre texte -> valeur (gere espaces fines, separateurs de milliers, decimale). */
export function parseLocaleNumber(raw: string, decimal: ',' | '.'): number | undefined {
  const v = raw.trim();
  if (v === '') return undefined;
  if (!(decimal === ',' ? NUMBER_FR : NUMBER_EN).test(v) && !NUMBER_PLAIN.test(v)) return undefined;
  let cleaned = v.replace(/[   ]/g, '');
  cleaned = decimal === ',' ? cleaned.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.') : cleaned.replace(/,(?=\d{3}(\D|$))/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(v: string, order: 'DMY' | 'MDY'): { serial: number; format: string } | undefined {
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  let year: number;
  let month: number;
  let day: number;
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return undefined;
    const a = Number(m[1]);
    const b = Number(m[2]);
    year = Number(m[3]);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    [day, month] = order === 'DMY' ? [a, b] : [b, a];
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day, Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return undefined;
  const hasTime = m[4] !== undefined;
  return { serial: dateToSerial(date), format: hasTime ? (m[6] !== undefined ? 'dd/mm/yyyy hh:mm:ss' : 'dd/mm/yyyy hh:mm') : 'dd/mm/yyyy' };
}

function inferValue(raw: string, decimal: ',' | '.', order: 'DMY' | 'MDY'): Parsed {
  const v = raw.trim();
  if (v === '') return { value: raw === '' ? null : raw };
  if (/^0\d+$/.test(v)) return { value: raw };
  const upper = v.toUpperCase();
  if (upper === 'VRAI' || upper === 'TRUE') return { value: true };
  if (upper === 'FAUX' || upper === 'FALSE') return { value: false };
  const error = parseErrorCode(v);
  if (error) return { value: error };
  const n = parseLocaleNumber(v, decimal);
  if (n !== undefined) return { value: n };
  const percent = v.match(/^(.+?)\s*%$/);
  if (percent?.[1]) {
    const p = parseLocaleNumber(percent[1], decimal);
    if (p !== undefined) return { value: p / 100, format: /[.,]\d/.test(percent[1]) ? '0.00%' : '0%' };
  }
  const euro = v.match(/^(.+?)\s*€$/);
  if (euro?.[1]) {
    const e = parseLocaleNumber(euro[1], decimal);
    if (e !== undefined) return { value: e, format: '#,##0.00 "€"' };
  }
  const date = parseDate(v, order);
  if (date) return { value: date.serial, format: date.format };
  return { value: raw };
}

/** Analyse un CSV et renvoie les informations detectees avec les lignes brutes. */
export function inspectCsv(input: Uint8Array | string, options: CsvReadOptions = {}): { info: CsvInfo; rows: string[][] } {
  const decoded = typeof input === 'string' ? { text: input, encoding: 'utf-8' as const, bom: false } : decodeText(input, options.encoding);
  const separator = options.separator ?? detectSeparator(decoded.text);
  const rows = parseCsvRows(decoded.text, separator, MAX_ROWS + 1);
  if (rows.length > MAX_ROWS) throw new SpreadsheetError(strings.csvTooLarge);
  const decimal = options.decimal ?? detectDecimal(rows, separator);
  return { info: { encoding: decoded.encoding, bom: decoded.bom, separator, decimal }, rows };
}

/** Lit un CSV / TSV dans un nouveau classeur (une feuille). */
export function readCsv(input: Uint8Array | string, options: CsvReadOptions = {}): Workbook {
  const { info, rows } = inspectCsv(input, options);
  const wb = createBlankWorkbook();
  wb.sourceFormat = 'csv';
  const sheet = wb.sheets[0];
  if (!sheet) return wb;
  if (options.sheetName) sheet.name = options.sheetName.slice(0, 31);
  const detect = options.detectTypes !== false;
  const order = options.dateOrder ?? 'DMY';
  const formatIds = new Map<string, number>();
  const styleFor = (format: string): number => {
    let id = formatIds.get(format);
    if (id === undefined) {
      id = styleIdFor(wb, { numberFormat: format });
      formatIds.set(format, id);
    }
    return id;
  };
  rows.forEach((fields, r) => {
    const line = new Map<number, Cell>();
    fields.slice(0, MAX_COLS).forEach((raw, c) => {
      if (raw === '') return;
      if (options.formulas && raw.startsWith('=') && raw.length > 1) {
        line.set(c, { value: null, formula: raw.slice(1) });
        return;
      }
      const parsed = detect ? inferValue(raw, info.decimal, order) : { value: raw };
      if (parsed.value === null) return;
      const cell: Cell = { value: parsed.value };
      if (parsed.format) cell.styleId = styleFor(parsed.format);
      line.set(c, cell);
    });
    if (line.size) sheet.cells.set(r, line);
  });
  return wb;
}

// ---------------------------------------------------------------- Ecriture

export interface CsvWriteOptions {
  /** Defaut « ; » (Excel francais). */
  separator?: string;
  /** Defaut « , ». */
  decimal?: ',' | '.';
  encoding?: CsvEncoding;
  /** BOM en tete (defaut vrai en UTF-8 : Excel reconnait alors l'encodage). */
  bom?: boolean;
  lineEnding?: '\r\n' | '\n';
  /** Booleens « VRAI/FAUX » (fr, defaut) ou « TRUE/FALSE » (en). */
  locale?: 'fr' | 'en';
  /** Ecrit « =formule » au lieu de la valeur calculee. */
  writeFormulas?: boolean;
  /** Prefixe « ' » devant le texte commencant par = + - @ (protection contre l'injection CSV). */
  escapeFormulas?: boolean;
  /** Mise en forme personnalisee (moteur de formats du Tableur) ; undefined = format par defaut. */
  format?: (cell: Cell, row: number, col: number) => string | undefined;
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

function formatDate(serial: number, wb: Workbook, code: string): string {
  const d = serialToDate(serial, wb.date1904);
  const date = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const hasDate = /[dy]/i.test(code.replace(/"[^"]*"/g, ''));
  const hasTime = /[hs]/i.test(code.replace(/"[^"]*"/g, ''));
  if (hasDate && hasTime) return `${date} ${time}`;
  return hasTime ? time : date;
}

function cellText(wb: Workbook, cell: Cell, row: number, col: number, options: CsvWriteOptions): string {
  const custom = options.format?.(cell, row, col);
  if (custom !== undefined) return custom;
  if (options.writeFormulas && cell.formula !== undefined) return `=${cell.formula}`;
  const value = cell.value;
  if (value === null) return '';
  if (typeof value === 'boolean') return options.locale === 'en' ? (value ? 'TRUE' : 'FALSE') : (value ? 'VRAI' : 'FAUX');
  if (isCellError(value)) return value.error;
  if (typeof value === 'number') {
    if (isDateCell(wb, cell)) {
      const xf = wb.styles.cellXfs[cell.styleId ?? 0];
      return formatDate(value, wb, numberFormatCode(wb.styles, xf?.numFmtId ?? 0));
    }
    const text = String(Math.abs(value) < 1e21 && Math.abs(value) >= 1e-7 || value === 0 ? Number(value.toPrecision(15)) : value);
    return (options.decimal ?? ',') === ',' ? text.replace('.', ',') : text;
  }
  if (options.escapeFormulas && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

function quote(field: string, separator: string): string {
  if (field.includes(separator) || /["\r\n]/.test(field) || /^\s|\s$/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

/** Ecrit une feuille en CSV (plage utilisee, en partant de A1 comme Excel). */
export function writeCsv(wb: Workbook, sheet: Sheet, options: CsvWriteOptions = {}): Uint8Array {
  const separator = options.separator ?? ';';
  const eol = options.lineEnding ?? '\r\n';
  const encoding = options.encoding ?? 'utf-8';
  let maxRow = -1;
  let maxCol = -1;
  for (const [row, line] of sheet.cells) {
    for (const [col, cell] of line) {
      if (cell.value === null && cell.formula === undefined) continue;
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
  }
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const line = sheet.cells.get(r);
    const fields: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = line?.get(c);
      fields.push(cell ? quote(cellText(wb, cell, r, c, options), separator) : '');
    }
    lines.push(fields.join(separator));
  }
  const text = lines.length ? lines.join(eol) + eol : '';
  return encodeText(text, encoding, options.bom ?? encoding === 'utf-8');
}
