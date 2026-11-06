// Lecture des elements annexes d'une feuille BIFF8 : commentaires (NOTE + OBJ + TXO), liens hypertexte (HLINK),
// couleur d'onglet (SheetExt), protection, validations de donnees (DV), mises en forme conditionnelles (CF) et
// filtres automatiques (AUTOFILTER). Les enregistrements tronques ou incoherents sont ignores un par un.
import type {
  CfOperator, CfRule, CellRange, ColumnFilter, ConditionalFormat, CustomFilterOperator, DataValidation, DifferentialFormat,
  FilterColumn, Hyperlink, Note, PasswordHash, Sheet, Workbook,
} from '../model.ts';
import { paletteColor, viewOf, type BiffRecord, type Palette } from './biff-records.ts';

const MAX_ITEMS = 50_000;

export interface ExtraDeps {
  wb: Workbook;
  palette: Palette;
  /** Decode une formule BIFF (references relatives a `row`/`col`). */
  decode: (rgce: Uint8Array, extra: Uint8Array, row: number, col: number) => string | undefined;
}

const u16 = (d: Uint8Array, p: number): number => (d[p] ?? 0) | ((d[p + 1] ?? 0) << 8);
const u32 = (d: Uint8Array, p: number): number => (u16(d, p) | (u16(d, p + 2) << 16)) >>> 0;

/** Chaine « XLUnicodeString » a `p` (cch sur 2 octets) ; renvoie le texte et la position suivante. */
function readStr(d: Uint8Array, p: number): { text: string; next: number } {
  const cch = u16(d, p);
  const wide = ((d[p + 2] ?? 0) & 1) !== 0;
  let text = '';
  const start = p + 3;
  const bytes = cch * (wide ? 2 : 1);
  if (start + bytes > d.length) throw new RangeError('chaine tronquee');
  for (let i = 0; i < cch; i++) text += String.fromCharCode(wide ? u16(d, start + i * 2) : d[start + i] ?? 0);
  return { text, next: start + bytes };
}

const cleanStr = (s: string): string | undefined => {
  const t = s.replace(/\u0000/g, '');
  return t === '' ? undefined : t;
};

function ref8(d: Uint8Array, p: number): CellRange {
  return { r1: u16(d, p), r2: u16(d, p + 2), c1: u16(d, p + 4), c2: Math.min(u16(d, p + 6), 16383) };
}

// ---------------------------------------------------------------- Commentaires

/** Texte d'une zone de texte TXO : octets de caracteres dans les CONTINUE qui suivent l'enregistrement. */
function txoText(rec: BiffRecord): string {
  const cch = u16(rec.data, 10);
  let out = '';
  for (const chunk of rec.continues) {
    if (out.length >= cch) break;
    const wide = ((chunk[0] ?? 0) & 1) !== 0;
    const take = Math.min(cch - out.length, Math.floor((chunk.length - 1) / (wide ? 2 : 1)));
    for (let i = 0; i < take; i++) out += String.fromCharCode(wide ? u16(chunk, 1 + i * 2) : chunk[1 + i] ?? 0);
  }
  return out.replace(/\r\n?/g, '\n');
}

// ---------------------------------------------------------------- Liens hypertexte

const URL_MONIKER = 'e0c9ea79f9bace118c8200aa004ba90b';
const FILE_MONIKER = '0303000000000000c000000000000046';

function utf16z(d: Uint8Array, p: number, bytes: number): string {
  let s = '';
  for (let i = 0; i + 1 < bytes && p + i + 1 < d.length; i += 2) {
    const c = u16(d, p + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function hex(d: Uint8Array, p: number, n: number): string {
  return Array.from(d.subarray(p, p + n), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readHyperlink(d: Uint8Array): Hyperlink | undefined {
  if (d.length < 32) return undefined;
  const link: Hyperlink = { ref: ref8(d, 0) };
  const flags = u32(d, 28);
  let p = 32;
  const lenStr = (): string => {
    const n = u32(d, p);
    if (n > 65536) throw new RangeError('lien trop long');
    const s = utf16z(d, p + 4, n * 2);
    p += 4 + n * 2;
    return s;
  };
  if (flags & 0x10) link.display = lenStr();
  if (flags & 0x80) lenStr();
  if (flags & 0x01) {
    const id = hex(d, p, 16);
    p += 16;
    if (id === URL_MONIKER) {
      const bytes = u32(d, p);
      link.target = utf16z(d, p + 4, Math.min(bytes, 65536));
      p += 4 + bytes;
    } else if (id === FILE_MONIKER) {
      const ansi = u32(d, p + 2);
      let s = '';
      for (let i = 0; i < ansi && i < 65536; i++) {
        const c = d[p + 6 + i] ?? 0;
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      link.target = s;
      p += 6 + ansi + 24;
    }
  }
  if (flags & 0x08) {
    const loc = lenStr();
    if (loc) link.location = loc;
  }
  if (!link.target && !link.location) return undefined;
  if (link.target && /^[\s\u0000-\u001f]*javascript:/i.test(link.target)) return undefined;
  if (link.display === '') delete link.display;
  return link;
}

// ---------------------------------------------------------------- Validations

const DV_TYPES: DataValidation['type'][] = ['none', 'whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom'];
const DV_OPERATORS: NonNullable<DataValidation['operator']>[] = [
  'between', 'notBetween', 'equal', 'notEqual', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual',
];

function readValidation(d: Uint8Array, deps: ExtraDeps): DataValidation | undefined {
  const flags = u32(d, 0);
  let p = 4;
  const texts: (string | undefined)[] = [];
  for (let i = 0; i < 4; i++) {
    const s = readStr(d, p);
    texts.push(cleanStr(s.text));
    p = s.next;
  }
  const f1 = u16(d, p);
  const rgce1 = d.subarray(p + 4, p + 4 + f1);
  p += 4 + f1;
  const f2 = u16(d, p);
  const rgce2 = d.subarray(p + 4, p + 4 + f2);
  p += 4 + f2;
  const count = u16(d, p);
  const ranges: CellRange[] = [];
  for (let i = 0; i < count && i < 1024 && p + 2 + (i + 1) * 8 <= d.length; i++) ranges.push(ref8(d, p + 2 + i * 8));
  const first = ranges[0];
  if (!first) return undefined;
  const type = DV_TYPES[flags & 15] ?? 'none';
  const v: DataValidation = { ranges, type };
  const op = DV_OPERATORS[(flags >> 20) & 15];
  if (op && type !== 'list' && type !== 'custom') v.operator = op;
  const formula = (rgce: Uint8Array): string | undefined => (rgce.length ? deps.decode(rgce, new Uint8Array(0), first.r1, first.c1)?.replace(/\u0000/g, ',') : undefined);
  const a = formula(rgce1);
  const b = formula(rgce2);
  if (a !== undefined) v.formula1 = a;
  if (b !== undefined) v.formula2 = b;
  if (flags & 0x100) v.allowBlank = true;
  if (flags & 0x200) v.inCellDropdown = false;
  if (flags & 0x40000) v.showInputMessage = true;
  if (flags & 0x80000) v.showErrorMessage = true;
  const style = (flags >> 4) & 7;
  if (style === 1) v.errorStyle = 'warning';
  else if (style === 2) v.errorStyle = 'information';
  if (texts[0]) v.promptTitle = texts[0];
  if (texts[1]) v.errorTitle = texts[1];
  if (texts[2]) v.prompt = texts[2];
  if (texts[3]) v.error = texts[3];
  return v;
}

// ---------------------------------------------------------------- Mises en forme conditionnelles

const CF_OPERATORS: Record<number, CfOperator> = {
  1: 'between', 2: 'notBetween', 3: 'equal', 4: 'notEqual', 5: 'greaterThan', 6: 'lessThan', 7: 'greaterThanOrEqual', 8: 'lessThanOrEqual',
};
const FONT_BLOCK = 118;
const BORDER_BLOCK = 8;
const PATTERN_BLOCK = 4;

function readRule(d: Uint8Array, deps: ExtraDeps, anchor: CellRange, priority: number): CfRule | undefined {
  const ct = d[0] ?? 0;
  if (ct !== 1 && ct !== 2) return undefined;
  const cce1 = u16(d, 2);
  const cce2 = u16(d, 4);
  const blocks = d.length - 12 - cce1 - cce2;
  const hasFont = [FONT_BLOCK, FONT_BLOCK + BORDER_BLOCK, FONT_BLOCK + PATTERN_BLOCK, FONT_BLOCK + BORDER_BLOCK + PATTERN_BLOCK].includes(blocks);
  const hasBorder = [BORDER_BLOCK, BORDER_BLOCK + PATTERN_BLOCK, FONT_BLOCK + BORDER_BLOCK, FONT_BLOCK + BORDER_BLOCK + PATTERN_BLOCK].includes(blocks);
  const hasPattern = [PATTERN_BLOCK, BORDER_BLOCK + PATTERN_BLOCK, FONT_BLOCK + PATTERN_BLOCK, FONT_BLOCK + BORDER_BLOCK + PATTERN_BLOCK].includes(blocks);
  if (blocks < 0 || (!hasFont && !hasBorder && !hasPattern && blocks !== 0)) return undefined;
  const dxf: DifferentialFormat = {};
  let p = 12;
  if (hasFont) {
    const f = d.subarray(p, p + FONT_BLOCK);
    const font: NonNullable<DifferentialFormat['font']> = {};
    const weight = u16(f, 72);
    if (weight !== 0xffff) font.bold = weight >= 600;
    const opts = u32(f, 68);
    if (opts & 2) font.italic = true;
    if (opts & 0x80) font.strike = true;
    const ul = f[76] ?? 0xff;
    if (ul === 1) font.underline = 'single';
    else if (ul === 2) font.underline = 'double';
    const icv = u32(f, 80);
    const color = icv === 0xffffffff ? undefined : paletteColor(deps.palette, icv);
    if (color) font.color = color;
    if (Object.keys(font).length) dxf.font = font;
    p += FONT_BLOCK;
  }
  if (hasBorder) p += BORDER_BLOCK;
  if (hasPattern) {
    const back = (u16(d, p + 2) >> 7) & 0x7f;
    const color = back === 64 ? undefined : paletteColor(deps.palette, back);
    if (color) dxf.fill = { type: 'pattern', pattern: 'solid', fg: color, bg: color };
    p += PATTERN_BLOCK;
  }
  const formulas: string[] = [];
  for (const [start, len] of [[p, cce1], [p + cce1, cce2]] as const) {
    if (!len) continue;
    const text = deps.decode(d.subarray(start, start + len), new Uint8Array(0), anchor.r1, anchor.c1);
    if (text === undefined) return undefined;
    formulas.push(text);
  }
  const wb = deps.wb;
  let dxfId: number | undefined;
  if (Object.keys(dxf).length) {
    wb.styles.dxfs.push(dxf);
    dxfId = wb.styles.dxfs.length - 1;
  }
  const rule: CfRule = ct === 1 ? { type: 'cellIs', priority, formulas } : { type: 'expression', priority, formulas };
  if (ct === 1) {
    const op = CF_OPERATORS[d[1] ?? 0];
    if (!op) return undefined;
    rule.operator = op;
  }
  if (dxfId !== undefined) rule.dxfId = dxfId;
  return rule;
}

// ---------------------------------------------------------------- Filtre automatique

const FILTER_OPERATORS: Record<number, CustomFilterOperator> = {
  1: 'lessThan', 2: 'equal', 3: 'lessThanOrEqual', 4: 'greaterThan', 5: 'notEqual', 6: 'greaterThanOrEqual',
};

function readAutoFilterColumn(d: Uint8Array): FilterColumn | undefined {
  const colId = u16(d, 0);
  const flags = u16(d, 2);
  const conditions: { operator: CustomFilterOperator; value: string }[] = [];
  let strPos = 4 + 20;
  const dopers = [4, 14];
  for (const at of dopers) {
    const vt = d[at] ?? 0;
    const op = FILTER_OPERATORS[d[at + 1] ?? 0];
    if (vt === 0 || !op) continue;
    let value: string | undefined;
    if (vt === 2) value = String(((u32(d, at + 2) << 0) >> 0) >> 0);
    else if (vt === 4) value = String(new DataView(d.buffer, d.byteOffset + at + 2, 8).getFloat64(0, true));
    else if (vt === 6) {
      const cch = d[at + 6] ?? 0;
      let s = '';
      const wide = ((d[strPos] ?? 0) & 1) !== 0;
      for (let i = 0; i < cch; i++) s += String.fromCharCode(wide ? u16(d, strPos + 1 + i * 2) : d[strPos + 1 + i] ?? 0);
      strPos += 1 + cch * (wide ? 2 : 1);
      value = s;
    } else if (vt === 0x0c) value = '';
    if (value !== undefined) conditions.push({ operator: op, value });
  }
  if (conditions.length === 0) return undefined;
  const filter: ColumnFilter = { kind: 'custom', conditions };
  if (flags & 1) filter.and = true;
  return { colId, filter };
}

// ---------------------------------------------------------------- Boucle principale

function passwordOf(value: number): PasswordHash {
  return { legacy: value.toString(16).toUpperCase().padStart(4, '0') };
}

/** Lit les elements annexes de la feuille dont l'enregistrement BOF est `records[start]`. */
export function readSheetExtras(records: BiffRecord[], start: number, sheet: Sheet, deps: ExtraDeps): void {
  const noteText = new Map<number, string>();
  let noteObj: number | undefined;
  let protect = false;
  let objects = false;
  let scenarios = false;
  let password = 0;
  let cf: { format: ConditionalFormat; left: number } | undefined;
  let priority = 0;
  const filterColumns: FilterColumn[] = [];
  let hasFilter = false;
  const tips: { ref: CellRange; text: string }[] = [];
  let depth = 0;
  for (let i = start + 1; i < records.length; i++) {
    const rec = records[i];
    if (!rec) break;
    if (rec.type === 0x0809) {
      depth++;
      continue;
    }
    if (rec.type === 0x000a) {
      if (depth === 0) break;
      depth--;
      continue;
    }
    if (depth > 0) continue;
    const d = rec.data;
    try {
      switch (rec.type) {
        case 0x005d:
          noteObj = u16(d, 0) === 0x0015 && u16(d, 4) === 0x0019 ? u16(d, 6) : undefined;
          break;
        case 0x01b6:
          if (noteObj !== undefined && d.length >= 14) noteText.set(noteObj, txoText(rec));
          noteObj = undefined;
          break;
        case 0x001c: {
          if (d.length < 11 || sheet.notes.length >= MAX_ITEMS) break;
          const author = readStr(d, 8).text;
          const note: Note = { ref: { row: u16(d, 0), col: Math.min(u16(d, 2), 16383) }, author, text: noteText.get(u16(d, 6)) ?? '' };
          if (u16(d, 4) & 2) note.visible = true;
          sheet.notes.push(note);
          break;
        }
        case 0x01b8: {
          const link = sheet.hyperlinks.length < MAX_ITEMS ? readHyperlink(d) : undefined;
          if (link) sheet.hyperlinks.push(link);
          break;
        }
        case 0x0800:
          if (d.length >= 12 && tips.length < MAX_ITEMS) tips.push({ ref: ref8(d, 2), text: utf16z(d, 10, d.length - 10) });
          break;
        case 0x0862:
          if (d.length >= 32 && (d[31] ?? 0) === 0xff) {
            const rgb = [d[28], d[29], d[30]].map((b) => (b ?? 0).toString(16).padStart(2, '0')).join('').toUpperCase();
            sheet.tabColor = { rgb: `FF${rgb}` };
          }
          break;
        case 0x0012: protect = u16(d, 0) !== 0; break;
        case 0x0063: objects = u16(d, 0) !== 0; break;
        case 0x00dd: scenarios = u16(d, 0) !== 0; break;
        case 0x0013: password = u16(d, 0); break;
        case 0x01be: {
          const v = sheet.dataValidations.length < MAX_ITEMS ? readValidation(d, deps) : undefined;
          if (v) sheet.dataValidations.push(v);
          break;
        }
        case 0x01b0: {
          if (d.length < 14 || sheet.conditionalFormats.length >= MAX_ITEMS) break;
          const ranges: CellRange[] = [];
          const n = u16(d, 12);
          for (let k = 0; k < n && k < 1024 && 14 + (k + 1) * 8 <= d.length; k++) ranges.push(ref8(d, 14 + k * 8));
          if (ranges.length === 0) break;
          cf = { format: { ranges, rules: [] }, left: u16(d, 0) };
          sheet.conditionalFormats.push(cf.format);
          break;
        }
        case 0x01b1: {
          const first = cf?.format.ranges[0];
          if (!cf || !first) break;
          const rule = readRule(d, deps, first, ++priority);
          if (rule) cf.format.rules.push(rule);
          break;
        }
        case 0x009d: hasFilter = true; break;
        case 0x009e: {
          const col = readAutoFilterColumn(d);
          if (col) filterColumns.push(col);
          break;
        }
        default: break;
      }
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  for (const tip of tips) {
    const link = sheet.hyperlinks.find((l) => l.ref.r1 === tip.ref.r1 && l.ref.c1 === tip.ref.c1);
    if (link && tip.text) link.tooltip = tip.text;
  }
  sheet.conditionalFormats = sheet.conditionalFormats.filter((f) => f.rules.length > 0);
  if (protect) {
    sheet.protection = { sheet: true, allow: {} };
    if (objects) sheet.protection.objects = true;
    if (scenarios) sheet.protection.scenarios = true;
    if (password) sheet.protection.password = passwordOf(password);
  }
  // La plage filtree est donnee par le nom integre _FilterDatabase : xls-read la renseigne.
  if (hasFilter || filterColumns.length) sheet.autoFilter = { ref: { r1: 0, c1: 0, r2: 0, c2: 0 }, columns: filterColumns };
}
