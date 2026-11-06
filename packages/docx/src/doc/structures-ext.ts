// Structures binaires Word 97-2003 (suite) : images OfficeArt (flux « Data »), sections (SED / SEPX), en-tetes et
// pieds (PlcfHdd), commentaires (ATRD), listes (LSTF / LFO / LVL). Toute lecture est bornee.
import { findBlip, type Blip } from '@forgeoffice/opc';
import type {
  AbstractNumbering, NumberFormat, NumberingInstance, NumberingLevel, Numbering, ParagraphProps, RunProps, Section,
  SectionBreakType,
} from '../model.ts';
import { twipsToPt } from '../units.ts';
import { symbolToUnicode } from './symbols.ts';
import { charFormat, paraFormat, plcCps, sprms, u16, u32, u8 } from './structures.ts';

const i16 = (b: Uint8Array, o: number): number => (u16(b, o) << 16) >> 16;

/** Chaine UTF-16LE de `count` unites. */
function utf16(b: Uint8Array, offset: number, count: number): string {
  let out = '';
  for (let i = 0; i < count && offset + i * 2 + 1 < b.length; i++) out += String.fromCharCode(u16(b, offset + i * 2));
  return out;
}

// ---------------------------------------------------------------- images (OfficeArt)

export interface Picture {
  blip: Blip;
  /** Taille d'affichage en points. */
  width: number;
  height: number;
}

/** PICF + donnees OfficeArt a `offset` du flux Data. */
export function readPicture(data: Uint8Array, offset: number): Picture | undefined {
  if (offset < 0 || offset + 68 > data.length) return undefined;
  const lcb = u32(data, offset);
  const cbHeader = u16(data, offset + 4);
  if (lcb < cbHeader || cbHeader < 68) return undefined;
  const mm = u16(data, offset + 6);
  const dxaGoal = u16(data, offset + 28);
  const dyaGoal = u16(data, offset + 30);
  const mx = u16(data, offset + 32) || 1000;
  const my = u16(data, offset + 34) || 1000;
  let start = offset + cbHeader;
  if (mm === 0x66) start += 1 + u8(data, start);
  const blip = findBlip(data, start, offset + lcb);
  if (!blip) return undefined;
  return { blip, width: twipsToPt((dxaGoal * mx) / 1000) || 72, height: twipsToPt((dyaGoal * my) / 1000) || 72 };
}

// ---------------------------------------------------------------- sections, en-tetes, pieds

export interface SectionInfo {
  /** CP de fin (exclus) de la section dans le texte principal. */
  cpEnd: number;
  section: Section;
}

const BREAKS: readonly SectionBreakType[] = ['continuous', 'nextColumn', 'nextPage', 'evenPage', 'oddPage'];

/** Applique les sprm de section (SEPX) a une copie de `base`. */
function applySectionSprms(base: Section, grpprl: Uint8Array): Section {
  const s: Section = { ...base, margins: { ...base.margins }, columns: { ...base.columns }, headers: {}, footers: {} };
  for (const { op, data } of sprms(grpprl)) {
    switch (op) {
      case 0x3009: s.breakType = BREAKS[u8(data, 0)] ?? 'nextPage'; break;
      case 0x300a: s.titlePage = u8(data, 0) !== 0; break;
      case 0x301d: s.orientation = u8(data, 0) === 2 ? 'landscape' : 'portrait'; break;
      case 0xb01f: s.pageWidth = twipsToPt(u16(data, 0)); break;
      case 0xb020: s.pageHeight = twipsToPt(u16(data, 0)); break;
      case 0xb021: s.margins.left = twipsToPt(u16(data, 0)); break;
      case 0xb022: s.margins.right = twipsToPt(u16(data, 0)); break;
      case 0x9023: s.margins.top = twipsToPt(i16(data, 0)); break;
      case 0x9024: s.margins.bottom = twipsToPt(i16(data, 0)); break;
      case 0xb025: s.margins.gutter = twipsToPt(u16(data, 0)); break;
      case 0xb017: s.margins.header = twipsToPt(u16(data, 0)); break;
      case 0xb018: s.margins.footer = twipsToPt(u16(data, 0)); break;
      case 0x500b: s.columns.count = Math.min(45, u16(data, 0) + 1); break;
      case 0x900c: s.columns.space = twipsToPt(u16(data, 0)); break;
      case 0x3005: s.columns.equalWidth = u8(data, 0) !== 0; break;
      case 0x3019: s.columns.separator = u8(data, 0) !== 0; break;
      default: break;
    }
  }
  return s;
}

/** Sections (PlcfSed + SEPX du flux WordDocument), du debut vers la fin du texte. */
export function readSections(word: Uint8Array, table: Uint8Array, fc: number, lcb: number, base: Section): SectionInfo[] {
  const cps = plcCps(table, fc, lcb, 12);
  const out: SectionInfo[] = [];
  for (let i = 0; i + 1 < cps.length && out.length < 1000; i++) {
    const fcSepx = u32(table, fc + (cps.length) * 4 + i * 12 + 2);
    const cb = fcSepx !== 0xffffffff && fcSepx + 2 <= word.length ? u16(word, fcSepx) : 0;
    const grpprl = cb ? word.subarray(fcSepx + 2, Math.min(word.length, fcSepx + 2 + cb)) : new Uint8Array(0);
    out.push({ cpEnd: cps[i + 1] ?? 0, section: applySectionSprms(base, grpprl) });
  }
  return out;
}

export interface HeaderStory {
  /** Indice de section (0..n-1). */
  section: number;
  kind: 'header' | 'footer';
  type: 'default' | 'first' | 'even';
  /** Plage [debut, fin) en CP relatifs au debut de l'histoire des en-tetes. */
  start: number;
  end: number;
}

/** Histoires d'en-tetes / pieds non vides : 6 histoires de separateurs, puis 6 par section (pair, impair, pied pair, impair, 1re). */
export function readHeaderStories(table: Uint8Array, fc: number, lcb: number): HeaderStory[] {
  const cps = plcCps(table, fc, lcb, 0);
  const out: HeaderStory[] = [];
  const layout: Array<[HeaderStory['kind'], HeaderStory['type']]> = [
    ['header', 'even'], ['header', 'default'], ['footer', 'even'], ['footer', 'default'], ['header', 'first'], ['footer', 'first'],
  ];
  for (let index = 6; index + 1 < cps.length && index < 6 + 6 * 1000; index++) {
    const start = cps[index] ?? 0;
    const end = cps[index + 1] ?? 0;
    const slot = layout[(index - 6) % 6];
    // Une histoire reduite a sa marque de paragraphe est vide (heritee de la section precedente).
    if (slot && end - start > 1) out.push({ section: Math.floor((index - 6) / 6), kind: slot[0], type: slot[1], start, end });
  }
  return out;
}

/** Option « pages paires et impaires differentes » (DOP.fFacingPages). */
export const facingPages = (table: Uint8Array, fc: number, lcb: number): boolean => lcb >= 2 && fc + 2 <= table.length && (u8(table, fc) & 1) !== 0;

// ---------------------------------------------------------------- commentaires

export interface CommentRef {
  /** Position de la marque dans le texte principal. */
  cp: number;
  initials: string;
  ibst: number;
  tag: number;
}

/** PlcfandRef : une ATRDPre10 de 30 octets par commentaire. */
export function readCommentRefs(table: Uint8Array, fc: number, lcb: number): CommentRef[] {
  const cps = plcCps(table, fc, lcb, 30);
  const base = fc + cps.length * 4;
  return cps.slice(0, -1).map((cp, i) => {
    const at = base + i * 30;
    const cch = Math.min(u16(table, at), 9);
    return { cp, initials: utf16(table, at + 2, cch), ibst: u16(table, at + 20), tag: u32(table, at + 26) | 0 };
  });
}

/** GrpXstAtnOwners : suite de chaines (cch + caracteres) des auteurs de commentaires. */
export function readAuthors(table: Uint8Array, fc: number, lcb: number): string[] {
  const out: string[] = [];
  let pos = fc;
  while (pos + 2 <= fc + lcb && pos + 2 <= table.length && out.length < 1024) {
    const cch = u16(table, pos);
    out.push(utf16(table, pos + 2, Math.min(cch, 256)));
    pos += 2 + cch * 2;
  }
  return out;
}

/** Etendue (CP debut, CP fin) de la zone commentee, par marque de zone (tag). */
export function readCommentRanges(table: Uint8Array, bkf: [number, number], bkl: [number, number], sttb: [number, number]): Map<number, [number, number]> {
  const starts = plcCps(table, bkf[0], bkf[1], 4);
  const ends = plcCps(table, bkl[0], bkl[1], 0);
  // SttbfAtnBkmk : en-tete de 6 octets (fExtend, cData, cbExtra), puis 2 octets de cch(0) + ATNBE (10 octets) par entree.
  const out = new Map<number, [number, number]>();
  const count = sttb[1] >= 6 ? u16(table, sttb[0] + 2) : 0;
  const cbExtra = sttb[1] >= 6 ? u16(table, sttb[0] + 4) : 0;
  let pos = sttb[0] + 6;
  for (let i = 0; i < Math.min(count, 4096) && pos + 2 + cbExtra <= table.length; i++) {
    const cch = u16(table, pos);
    pos += 2 + cch * 2;
    const tag = u32(table, pos + 2) | 0;
    pos += cbExtra;
    const start = starts[i];
    const endIndex = u16(table, bkf[0] + starts.length * 4 + i * 4);
    const end = ends[endIndex];
    if (start !== undefined && end !== undefined && i < starts.length - 1) out.set(tag, [start, end]);
  }
  return out;
}

// ---------------------------------------------------------------- listes

const NFC: Readonly<Record<number, NumberFormat>> = {
  0: 'decimal', 1: 'upperRoman', 2: 'lowerRoman', 3: 'upperLetter', 4: 'lowerLetter', 5: 'ordinal', 6: 'cardinalText', 7: 'ordinalText',
  22: 'decimalZero', 23: 'bullet', 255: 'none',
};

interface LvlRead {
  level: NumberingLevel;
  next: number;
}

/** LVL : LVLF (28 octets) + sprm de paragraphe et de caracteres + texte du niveau. */
function readLvl(table: Uint8Array, pos: number, index: number, fonts: readonly string[]): LvlRead | undefined {
  if (pos + 28 > table.length) return undefined;
  const nfc = u8(table, pos + 4);
  const flags = u8(table, pos + 5);
  const follow = u8(table, pos + 15);
  const cbChpx = u8(table, pos + 24);
  const cbPapx = u8(table, pos + 25);
  let at = pos + 28;
  const papx = table.subarray(at, at + cbPapx);
  at += cbPapx;
  const chpx = table.subarray(at, at + cbChpx);
  at += cbChpx;
  if (at + 2 > table.length) return undefined;
  const cch = Math.min(u16(table, at), 255);
  const raw = utf16(table, at + 2, cch);
  const next = at + 2 + cch * 2;
  const run: RunProps = charFormat(chpx, fonts).props;
  const format = NFC[nfc] ?? 'decimal';
  const paragraph: ParagraphProps = {};
  const pf = paraFormat(papx).props;
  if (pf.indentLeft !== undefined) paragraph.indentLeft = pf.indentLeft;
  if (pf.indentFirstLine !== undefined) paragraph.indentFirstLine = pf.indentFirstLine;
  let text = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (format !== 'bullet' && code < 9) text += `%${code + 1}`;
    else text += format === 'bullet' ? (symbolToUnicode(run.font ?? '', code) ?? (code >= 0xf000 ? '•' : ch)) : ch;
  }
  if (format === 'bullet' && run.font && symbolToUnicode(run.font, 0x20)) delete run.font;
  const level: NumberingLevel = {
    level: index, format, text: format === 'none' ? '' : text, start: u32(table, pos) | 0 || 1,
    alignment: (['left', 'center', 'right'] as const)[flags & 3] ?? 'left',
    suffix: follow === 1 ? 'space' : follow === 2 ? 'nothing' : 'tab',
  };
  if (flags & 4) level.isLegal = true;
  if (Object.keys(paragraph).length) level.paragraph = paragraph;
  if (Object.keys(run).length) level.run = run;
  return { level, next };
}

/** PlfLst + PlfLfo -> modele de numerotation (instance n = LFO n, ilfo de Word, base 1). */
export function readLists(table: Uint8Array, lst: [number, number], lfo: [number, number], fonts: readonly string[]): Numbering {
  const out: Numbering = { abstracts: [], instances: [] };
  if (lst[1] < 2 || lst[0] + lst[1] > table.length) return out;
  const count = Math.min(u16(table, lst[0]), 2048);
  const ids: number[] = [];
  const flags: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const at = lst[0] + 2 + i * 28;
    ids.push(u32(table, at));
    flags.push((u8(table, at + 26) & 1) !== 0);
  }
  let pos = lst[0] + 2 + count * 28;
  const abstracts: AbstractNumbering[] = [];
  for (let i = 0; i < count; i++) {
    const levels: NumberingLevel[] = [];
    for (let l = 0; l < (flags[i] ? 1 : 9); l++) {
      const read = readLvl(table, pos, l, fonts);
      if (!read) break;
      levels.push(read.level);
      pos = read.next;
    }
    abstracts.push({ id: i, multiLevelType: flags[i] ? 'singleLevel' : 'multilevel', levels });
  }
  out.abstracts = abstracts;
  if (lfo[1] >= 4 && lfo[0] + lfo[1] <= table.length) {
    const lfoCount = Math.min(u32(table, lfo[0]), 4096);
    let data = lfo[0] + 4 + lfoCount * 16;
    for (let i = 0; i < lfoCount; i++) {
      const at = lfo[0] + 4 + i * 16;
      const abstractId = ids.indexOf(u32(table, at));
      const overrides: NumberingInstance['overrides'] = [];
      const levelCount = u8(table, at + 12);
      data += 4;
      for (let l = 0; l < levelCount && data + 8 <= table.length; l++) {
        const flag = u32(table, data + 4);
        data += 8;
        const level = flag & 0x0f;
        const override: NumberingInstance['overrides'][number] = { level };
        if (flag & 0x10) override.startOverride = u32(table, data - 8) | 0;
        if (flag & 0x20) {
          const read = readLvl(table, data, level, fonts);
          if (read) {
            override.definition = read.level;
            data = read.next;
          }
        }
        overrides.push(override);
      }
      if (abstractId >= 0) out.instances.push({ id: i + 1, abstractId, overrides });
    }
  }
  return out;
}
