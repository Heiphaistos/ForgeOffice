// Lecture des classeurs Excel 97-2003 (.xls, BIFF8 dans un conteneur OLE) : feuilles, valeurs, chaines
// partagees (texte enrichi), formats de nombre, polices, bordures, remplissages, formules (texte), fusions,
// largeurs/hauteurs, volets, zoom, marges, en-tetes, noms definis. Graphiques, images et commentaires ignores.
import { quoteSheetName } from '../address.ts';
import { BUILTIN_NUMBER_FORMATS } from '../constants.ts';
import { MAX_ROWS, type Cell, type CellValue, type Font, type RowInfo, type Sheet, type Workbook } from '../model.ts';
import { SpreadsheetError, strings } from '../strings.ts';
import { createBlankWorkbook, createSheet, defaultStyles, parseErrorCode, styleIdFor, uniqueSheetName } from '../workbook.ts';
import { addDefinedName } from '../xlsx/read-workbook.ts';
import { BIFF_ERRORS, decodeFormula, type FormulaContext } from './biff-formula.ts';
import {
  ChunkReader, fontAt, readFontRecord, readPalette, readSst, readUnicodeString, readXfRecord, richRuns, splitRecords,
  stringAt, viewOf, type BiffRecord, type BiffString, type Palette, type RawXf,
} from './biff-records.ts';
import { CfbError, CfbFile } from './cfb.ts';

const MAX_SHEETS = 4096;
const MAX_CELLS_PER_SHEET = 20_000_000;

const BUILTIN_NAMES: Readonly<Record<number, string>> = {
  0x00: 'Consolidate_Area', 0x01: 'Auto_Open', 0x02: 'Auto_Close', 0x03: 'Extract', 0x04: 'Database', 0x05: 'Criteria',
  0x06: 'Print_Area', 0x07: 'Print_Titles', 0x08: 'Recorder', 0x09: 'Data_Form', 0x0a: 'Auto_Activate',
  0x0b: 'Auto_Deactivate', 0x0c: 'Sheet_Title', 0x0d: '_FilterDatabase',
};

interface BoundSheet {
  name: string;
  offset: number;
  state: Sheet['state'];
  kind: number;
  /** Index dans wb.sheets (feuilles de calcul seulement). */
  index?: number;
}

interface SupBook {
  internal: boolean;
  externNames: string[];
}

interface Globals {
  fonts: Font[];
  formats: Map<number, string>;
  xfs: RawXf[];
  palette: Palette;
  sst: BiffString[];
  sheets: BoundSheet[];
  supbooks: SupBook[];
  externSheets: { supbook: number; first: number; last: number }[];
  names: { name: string; local?: number; hidden: boolean; rgce: Uint8Array; extra: Uint8Array }[];
  date1904: boolean;
}

interface ReadState {
  wb: Workbook;
  g: Globals;
  styleIds: Map<number, number>;
}

function fail(message: string = strings.xlsInvalid): never {
  throw new SpreadsheetError(message);
}

function readBof(record: BiffRecord | undefined): void {
  if (!record) fail();
  if (record.type === 0x0009 || record.type === 0x0209 || record.type === 0x0409) fail(strings.xlsTooOld);
  if (record.type !== 0x0809 || record.data.length < 4) fail();
  if (viewOf(record.data).getUint16(0, true) !== 0x0600) fail(strings.xlsTooOld);
}

function readGlobals(records: BiffRecord[]): { g: Globals; end: number } {
  readBof(records[0]);
  const g: Globals = {
    fonts: [], formats: new Map(), xfs: [], palette: {}, sst: [], sheets: [], supbooks: [], externSheets: [], names: [], date1904: false,
  };
  const pendingXf: Uint8Array[] = [];
  const pendingFonts: Uint8Array[] = [];
  let i = 1;
  for (; i < records.length; i++) {
    const rec = records[i];
    if (!rec) break;
    const { data } = rec;
    const view = viewOf(data);
    if (rec.type === 0x000a) break;
    if (data.length < 2 && rec.type !== 0x00fc) continue;
    switch (rec.type) {
      case 0x002f: fail(strings.xlsEncrypted);
      case 0x0022: g.date1904 = view.getUint16(0, true) === 1; break;
      case 0x0031: pendingFonts.push(data); break;
      case 0x0092: g.palette = readPalette(data); break;
      case 0x041e: g.formats.set(view.getUint16(0, true), stringAt(data, 2, 2)); break;
      case 0x00e0: if (data.length >= 20) pendingXf.push(data); break;
      case 0x00fc: g.sst = readSst(rec, MAX_ROWS * 4); break;
      case 0x0085: {
        if (g.sheets.length >= MAX_SHEETS) fail(strings.tooManySheets);
        const state = (data[4] ?? 0) & 3;
        g.sheets.push({
          name: stringAt(data, 6, 1),
          offset: view.getUint32(0, true),
          state: state === 1 ? 'hidden' : state === 2 ? 'veryHidden' : 'visible',
          kind: data[5] ?? 0,
        });
        break;
      }
      case 0x01ae: g.supbooks.push({ internal: data.length === 4 && view.getUint16(2, true) === 0x0401, externNames: [] }); break;
      case 0x0023: {
        const book = g.supbooks[g.supbooks.length - 1];
        if (book && data.length > 7) book.externNames.push(stringAt(data, 6, 1));
        break;
      }
      case 0x0017: {
        const reader = new ChunkReader(rec);
        const count = reader.u16();
        for (let k = 0; k < count; k++) g.externSheets.push({ supbook: reader.u16(), first: reader.u16(), last: reader.u16() });
        break;
      }
      case 0x0018: readName(rec, g); break;
      default: break;
    }
  }
  g.fonts = pendingFonts.map((d) => readFontRecord(d, g.palette));
  g.xfs = pendingXf.map((d) => readXfRecord(d, g.palette));
  return { g, end: i };
}

function readName(rec: BiffRecord, g: Globals): void {
  const data = rec.continues.length ? concatRecord(rec) : rec.data;
  if (data.length < 15) return;
  const view = viewOf(data);
  const flags = view.getUint16(0, true);
  const cch = data[3] ?? 0;
  const cce = view.getUint16(4, true);
  const itab = view.getUint16(8, true);
  const wide = ((data[14] ?? 0) & 1) !== 0;
  const nameStart = 15;
  const nameEnd = nameStart + cch * (wide ? 2 : 1);
  let name = '';
  if (flags & 0x20) {
    name = `_xlnm.${BUILTIN_NAMES[data[nameStart] ?? 0] ?? 'Unknown'}`;
  } else {
    for (let p = nameStart; p < nameEnd && p < data.length; p += wide ? 2 : 1) name += String.fromCharCode(wide ? view.getUint16(p, true) : data[p] ?? 0);
  }
  const entry: Globals['names'][number] = {
    name,
    hidden: (flags & 1) !== 0,
    rgce: data.subarray(nameEnd, nameEnd + cce),
    extra: data.subarray(nameEnd + cce),
  };
  if (itab > 0) entry.local = itab - 1;
  g.names.push(entry);
}

function concatRecord(rec: BiffRecord): Uint8Array {
  const parts = [rec.data, ...rec.continues];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function formulaContext(g: Globals, row: number, col: number): FormulaContext {
  return {
    row,
    col,
    sheetRef: (ixti) => {
      const xti = g.externSheets[ixti];
      if (!xti || !g.supbooks[xti.supbook]?.internal) return undefined;
      const first = g.sheets[xti.first];
      if (!first) return xti.first >= 0xfffe ? '#REF' : undefined;
      const last = g.sheets[xti.last];
      return last && xti.last !== xti.first ? quoteSheetName(`${first.name}:${last.name}`) : quoteSheetName(first.name);
    },
    name: (index) => g.names[index - 1]?.name,
    externName: (ixti, index) => {
      const xti = g.externSheets[ixti];
      return xti ? g.supbooks[xti.supbook]?.externNames[index - 1] : undefined;
    },
  };
}

function styleOf(state: ReadState, ixfe: number): number | undefined {
  const cached = state.styleIds.get(ixfe);
  if (cached !== undefined) return cached || undefined;
  const xf = state.g.xfs[ixfe];
  let id = 0;
  if (xf) {
    const font = fontAt(state.g.fonts, xf.ifnt);
    const code = xf.ifmt === 0 ? undefined : state.g.formats.get(xf.ifmt) ?? BUILTIN_NUMBER_FORMATS[xf.ifmt];
    id = styleIdFor(state.wb, { ...xf.spec, ...(font ? { font } : {}), ...(code ? { numberFormat: code } : {}) });
  }
  state.styleIds.set(ixfe, id);
  return id || undefined;
}

function rkValue(rk: number): number {
  let value: number;
  if (rk & 2) {
    value = rk >> 2;
  } else {
    const buffer = new DataView(new ArrayBuffer(8));
    buffer.setUint32(4, (rk & 0xfffffffc) >>> 0, true);
    value = buffer.getFloat64(0, true);
  }
  return rk & 1 ? value / 100 : value;
}

interface PendingExp {
  row: number;
  col: number;
  cell: Cell;
  master: string;
}

interface SharedDef {
  rgce: Uint8Array;
  extra: Uint8Array;
  range?: { r1: number; c1: number; r2: number; c2: number };
}

function formulaParts(data: Uint8Array, start: number): { rgce: Uint8Array; extra: Uint8Array } {
  const cce = viewOf(data).getUint16(start, true);
  return { rgce: data.subarray(start + 2, start + 2 + cce), extra: data.subarray(start + 2 + cce) };
}

function readSheet(records: BiffRecord[], start: number, sheet: Sheet, state: ReadState): void {
  readBof(records[start]);
  const { g } = state;
  let count = 0;
  const put = (row: number, col: number, cell: Cell): void => {
    if (++count > MAX_CELLS_PER_SHEET) fail(strings.tooManyCells);
    let line = sheet.cells.get(row);
    if (!line) {
      line = new Map();
      sheet.cells.set(row, line);
    }
    line.set(col, cell);
  };
  const cellWith = (value: CellValue, ixfe: number): Cell => {
    const cell: Cell = { value };
    const styleId = styleOf(state, ixfe);
    if (styleId) cell.styleId = styleId;
    return cell;
  };
  const pending: PendingExp[] = [];
  const shared = new Map<string, SharedDef>();
  let stringTarget: Cell | undefined;
  for (let i = start + 1; i < records.length; i++) {
    const rec = records[i];
    if (!rec || rec.type === 0x000a) break;
    if (rec.type === 0x0809) {
      // Sous-flux imbrique (graphique incorpore) : sauter jusqu'a son EOF.
      while (i < records.length && records[i]?.type !== 0x000a) i++;
      continue;
    }
    const { data } = rec;
    const view = viewOf(data);
    if (data.length < 4 && rec.type !== 0x0207) {
      readSheetLayout(rec, sheet, state);
      continue;
    }
    const row = view.getUint16(0, true);
    const col = view.getUint16(2, true);
    switch (rec.type) {
      case 0x0203: if (data.length >= 14) put(row, col, cellWith(view.getFloat64(6, true), view.getUint16(4, true))); break;
      case 0x027e: if (data.length >= 10) put(row, col, cellWith(rkValue(view.getUint32(6, true)), view.getUint16(4, true))); break;
      case 0x00bd: {
        for (let p = 4, c = col; p + 6 <= data.length - 2; p += 6, c++) put(row, c, cellWith(rkValue(view.getUint32(p + 2, true)), view.getUint16(p, true)));
        break;
      }
      case 0x00fd: {
        if (data.length < 10) break;
        const s = g.sst[view.getUint32(6, true)];
        const cell = cellWith(s?.text ?? '', view.getUint16(4, true));
        const rich = s ? richRuns(s, g.fonts) : undefined;
        if (rich) cell.rich = rich;
        put(row, col, cell);
        break;
      }
      case 0x0204: put(row, col, cellWith(readUnicodeString(new ChunkReader(rec, 6), 2, false).text, view.getUint16(4, true))); break;
      case 0x0205: {
        if (data.length < 8) break;
        const raw = data[6] ?? 0;
        const value: CellValue = data[7] ? (parseErrorCode(BIFF_ERRORS[raw] ?? '#N/A') ?? null) : raw !== 0;
        put(row, col, cellWith(value, view.getUint16(4, true)));
        break;
      }
      case 0x0201: {
        const styleId = styleOf(state, view.getUint16(4, true));
        if (styleId) put(row, col, { value: null, styleId });
        break;
      }
      case 0x00be: {
        for (let p = 4, c = col; p + 2 <= data.length - 2; p += 2, c++) {
          const styleId = styleOf(state, view.getUint16(p, true));
          if (styleId) put(row, c, { value: null, styleId });
        }
        break;
      }
      case 0x0006: {
        if (data.length < 22) break;
        let value: CellValue = null;
        stringTarget = undefined;
        if (view.getUint16(12, true) === 0xffff) {
          const kind = data[6] ?? 0;
          if (kind === 1) value = (data[8] ?? 0) !== 0;
          else if (kind === 2) value = parseErrorCode(BIFF_ERRORS[data[8] ?? 0] ?? '#N/A') ?? null;
          else if (kind === 3) value = '';
        } else {
          value = view.getFloat64(6, true);
        }
        const cell = cellWith(value, view.getUint16(4, true));
        if (view.getUint16(12, true) === 0xffff && (data[6] ?? 0) === 0) stringTarget = cell;
        const { rgce, extra } = formulaParts(data, 20);
        const decoded = decodeFormula(rgce, extra, formulaContext(g, row, col));
        if (decoded && 'text' in decoded) cell.formula = decoded.text;
        else if (decoded) pending.push({ row, col, cell, master: `${decoded.exp.row},${decoded.exp.col}` });
        put(row, col, cell);
        break;
      }
      case 0x0207: {
        if (stringTarget && data.length >= 3) stringTarget.value = readUnicodeString(new ChunkReader(rec), 2, false).text;
        stringTarget = undefined;
        break;
      }
      case 0x04bc: {
        if (data.length < 10) break;
        shared.set(`${row},${data[4] ?? 0}`, formulaParts(data, 8));
        break;
      }
      case 0x0221: {
        if (data.length < 14) break;
        const parts = formulaParts(data, 12);
        // RefU : premiere et derniere ligne (u16), premiere et derniere colonne (u8).
        const range = { r1: row, r2: view.getUint16(2, true), c1: data[4] ?? 0, c2: data[5] ?? 0 };
        shared.set(`${row},${range.c1}`, { ...parts, range });
        break;
      }
      default: readSheetLayout(rec, sheet, state);
    }
  }
  for (const p of pending) {
    const def = shared.get(p.master);
    if (!def) continue;
    if (def.range) {
      if (`${p.row},${p.col}` !== p.master) continue;
      const decoded = decodeFormula(def.rgce, def.extra, formulaContext(g, p.row, p.col));
      if (decoded && 'text' in decoded) {
        p.cell.formula = decoded.text;
        p.cell.array = { ref: def.range };
      }
      continue;
    }
    const decoded = decodeFormula(def.rgce, def.extra, formulaContext(g, p.row, p.col), true);
    if (decoded && 'text' in decoded) p.cell.formula = decoded.text;
  }
}

/** Enregistrements de mise en page et d'affichage d'une feuille. */
function readSheetLayout(rec: BiffRecord, sheet: Sheet, state: ReadState): void {
  const { data } = rec;
  if (data.length < 2) return;
  const view = viewOf(data);
  switch (rec.type) {
    case 0x00e5: {
      const count = Math.min(view.getUint16(0, true), Math.floor((data.length - 2) / 8));
      for (let k = 0; k < count; k++) {
        const p = 2 + k * 8;
        sheet.merges.push({ r1: view.getUint16(p, true), r2: view.getUint16(p + 2, true), c1: view.getUint16(p + 4, true), c2: view.getUint16(p + 6, true) });
      }
      break;
    }
    case 0x007d: {
      if (data.length < 10) break;
      const flags = view.getUint16(8, true);
      const info: Sheet['cols'][number] = { min: view.getUint16(0, true), max: Math.min(view.getUint16(2, true), 255), width: view.getUint16(4, true) / 256 };
      if (flags & 1) info.hidden = true;
      if (flags & 4) info.bestFit = true;
      if ((flags >> 8) & 7) info.outlineLevel = (flags >> 8) & 7;
      if (flags & 0x1000) info.collapsed = true;
      const styleId = styleOf(state, view.getUint16(6, true));
      if (styleId) info.styleId = styleId;
      sheet.cols.push(info);
      break;
    }
    case 0x0208: {
      if (data.length < 16) break;
      const flags = view.getUint16(12, true);
      const info: RowInfo = {};
      if (flags & 0x40) info.height = (view.getUint16(6, true) & 0x7fff) / 20;
      if (flags & 0x20) info.hidden = true;
      if (flags & 7) info.outlineLevel = flags & 7;
      if (flags & 0x10) info.collapsed = true;
      if (flags & 0x80) {
        const styleId = styleOf(state, view.getUint16(14, true) & 0x0fff);
        if (styleId) info.styleId = styleId;
      }
      if (Object.keys(info).length) sheet.rows.set(view.getUint16(0, true), info);
      break;
    }
    case 0x0225: if (data.length >= 4) sheet.defaultRowHeight = view.getUint16(2, true) / 20; break;
    case 0x0055: sheet.baseColWidth = view.getUint16(0, true); break;
    case 0x023e: {
      const flags = view.getUint16(0, true);
      sheet.view.showFormulas = (flags & 1) !== 0 || undefined;
      sheet.view.showGridLines = (flags & 2) !== 0;
      sheet.view.showHeaders = (flags & 4) !== 0;
      sheet.view.showZeros = (flags & 0x10) !== 0;
      if (flags & 0x40) sheet.view.rightToLeft = true;
      if (flags & 0x200) sheet.view.tabSelected = true;
      if (flags & 0x800) sheet.view.view = 'pageBreakPreview';
      if (flags & 8) sheet.view.frozen = { rows: 0, cols: 0 };
      if (sheet.view.showFormulas === undefined) delete sheet.view.showFormulas;
      break;
    }
    case 0x0041: {
      if (sheet.view.frozen && data.length >= 4) {
        sheet.view.frozen = { cols: view.getUint16(0, true), rows: view.getUint16(2, true) };
        if (!sheet.view.frozen.cols && !sheet.view.frozen.rows) delete sheet.view.frozen;
      }
      break;
    }
    case 0x00a0: {
      const den = view.getUint16(2, true);
      if (den) sheet.view.zoom = Math.max(10, Math.min(400, Math.round((view.getUint16(0, true) * 100) / den)));
      break;
    }
    case 0x0026: if (data.length >= 8) sheet.pageSetup.margins.left = view.getFloat64(0, true); break;
    case 0x0027: if (data.length >= 8) sheet.pageSetup.margins.right = view.getFloat64(0, true); break;
    case 0x0028: if (data.length >= 8) sheet.pageSetup.margins.top = view.getFloat64(0, true); break;
    case 0x0029: if (data.length >= 8) sheet.pageSetup.margins.bottom = view.getFloat64(0, true); break;
    case 0x0014:
    case 0x0015: {
      const text = stringAt(data, 0, 2);
      if (!text) break;
      const hf = (sheet.pageSetup.headerFooter ??= {});
      if (rec.type === 0x0014) hf.oddHeader = text;
      else hf.oddFooter = text;
      break;
    }
    case 0x00a1: {
      if (data.length < 34) break;
      const flags = view.getUint16(10, true);
      if (!(flags & 4)) {
        sheet.pageSetup.paperSize = view.getUint16(0, true);
        sheet.pageSetup.scale = view.getUint16(2, true);
        sheet.pageSetup.orientation = flags & 2 ? 'portrait' : 'landscape';
      }
      sheet.pageSetup.margins.header = view.getFloat64(16, true);
      sheet.pageSetup.margins.footer = view.getFloat64(24, true);
      const fitWidth = view.getUint16(6, true);
      const fitHeight = view.getUint16(8, true);
      if (fitWidth !== 1) sheet.pageSetup.fitToWidth = fitWidth;
      if (fitHeight !== 1) sheet.pageSetup.fitToHeight = fitHeight;
      break;
    }
    case 0x0081: {
      // WSBOOL : ajustement a la page et position des totaux de plan.
      const flags = view.getUint16(0, true);
      if (flags & 0x100) sheet.pageSetup.fitToPage = true;
      sheet.outline.summaryBelow = (flags & 0x40) !== 0;
      sheet.outline.summaryRight = (flags & 0x80) !== 0;
      break;
    }
    case 0x002b: if (view.getUint16(0, true)) sheet.pageSetup.printGridLines = true; break;
    case 0x002a: if (view.getUint16(0, true)) sheet.pageSetup.printHeadings = true; break;
    case 0x0083: if (view.getUint16(0, true)) sheet.pageSetup.horizontalCentered = true; break;
    case 0x0084: if (view.getUint16(0, true)) sheet.pageSetup.verticalCentered = true; break;
    default: break;
  }
}

/** Lit un classeur .xls (BIFF8). Leve SpreadsheetError (message francais) si illisible. */
export function readXls(bytes: Uint8Array): Workbook {
  let stream: Uint8Array;
  try {
    const cfb = new CfbFile(bytes);
    if (cfb.find('EncryptedPackage') || cfb.find('EncryptionInfo')) fail(strings.xlsEncrypted);
    const entry = cfb.find('Workbook') ?? cfb.find('Book');
    if (!entry) fail();
    if (entry.name.toLowerCase() === 'book') fail(strings.xlsTooOld);
    stream = cfb.read(entry);
  } catch (error) {
    if (error instanceof CfbError) fail(`${strings.cfbInvalid} (${error.message})`);
    throw error;
  }
  const records = splitRecords(stream);
  try {
    const { g } = readGlobals(records);
    const wb = createBlankWorkbook();
    wb.sourceFormat = 'xls';
    wb.date1904 = g.date1904;
    wb.sheets = [];
    wb.properties = { application: 'Microsoft Excel' };
    const font0 = g.fonts[0];
    if (font0) wb.styles = defaultStyles(font0);
    const state: ReadState = { wb, g, styleIds: new Map() };
    const offsets = new Map(records.map((r, i) => [r.offset, i]));
    for (const bound of g.sheets) {
      if (bound.kind !== 0) continue;
      const start = offsets.get(bound.offset);
      if (start === undefined) continue;
      const sheet = createSheet(uniqueSheetName(wb, bound.name || `${strings.sheetPrefix}${wb.sheets.length + 1}`));
      sheet.state = bound.state;
      sheet.view.tabSelected = false;
      bound.index = wb.sheets.length;
      wb.sheets.push(sheet);
      readSheet(records, start, sheet, state);
    }
    if (wb.sheets.length === 0) fail(strings.noSheets);
    for (const name of g.names) {
      const decoded = decodeFormula(name.rgce, name.extra, formulaContext(g, 0, 0));
      // Les noms « _xlfn.* » sont des marqueurs internes d'Excel pour les fonctions recentes.
      if (!decoded || !('text' in decoded) || !name.name || name.name.startsWith('_xlfn.')) continue;
      const local = name.local === undefined ? undefined : g.sheets[name.local]?.index;
      addDefinedName(wb, name.name, decoded.text, local, name.hidden);
    }
    const selected = wb.sheets.findIndex((s) => s.view.tabSelected);
    wb.activeSheet = Math.max(0, selected >= 0 ? selected : wb.sheets.findIndex((s) => s.state === 'visible'));
    const active = wb.sheets[wb.activeSheet];
    if (active) active.view.tabSelected = true;
    return wb;
  } catch (error) {
    if (error instanceof RangeError) fail(`${strings.xlsInvalid} (${error.message})`);
    throw error;
  }
}
