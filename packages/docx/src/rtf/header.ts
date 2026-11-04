// Tables d'en-tete RTF : polices, couleurs, informations, listes ; correspondances partagees lecture/ecriture.
import type { AbstractNumbering, DocumentProperties, HighlightColor, NumberFormat, NumberingLevel } from '../model.ts';
import { twipsToPt } from '../units.ts';
import { groupText, type RtfGroup } from './tokens.ts';

export const NFC_TO_FORMAT: Readonly<Record<number, NumberFormat>> = {
  0: 'decimal', 1: 'upperRoman', 2: 'lowerRoman', 3: 'upperLetter', 4: 'lowerLetter', 5: 'ordinal', 6: 'cardinalText',
  7: 'ordinalText', 22: 'decimalZero', 23: 'bullet', 255: 'none',
};

export const FORMAT_TO_NFC: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(NFC_TO_FORMAT).map(([nfc, format]) => [format, Number(nfc)]),
);

/** Identifiants de langue Windows (LCID) les plus courants. */
export const LCID_TO_LANG: Readonly<Record<number, string>> = {
  1036: 'fr-FR', 2060: 'fr-BE', 3084: 'fr-CA', 4108: 'fr-CH', 1033: 'en-US', 2057: 'en-GB', 1031: 'de-DE', 3082: 'es-ES',
  1040: 'it-IT', 2070: 'pt-PT', 1046: 'pt-BR', 1043: 'nl-NL', 1049: 'ru-RU', 1041: 'ja-JP', 2052: 'zh-CN', 1025: 'ar-SA',
  1037: 'he-IL', 1045: 'pl-PL', 1055: 'tr-TR', 1024: 'x-none',
};

export const LANG_TO_LCID: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(LCID_TO_LANG).map(([lcid, lang]) => [lang.toLowerCase(), Number(lcid)]),
);

/** Couleurs de surlignage Word (index de la table \highlight). */
export const HIGHLIGHT_RGB: Readonly<Record<Exclude<HighlightColor, 'none'>, string>> = {
  black: '000000', blue: '0000FF', cyan: '00FFFF', green: '00FF00', magenta: 'FF00FF', red: 'FF0000', yellow: 'FFFF00',
  white: 'FFFFFF', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000',
  darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0',
};

/** Surlignage Word le plus proche d'une couleur RGB. */
export function nearestHighlight(rgb: string): HighlightColor {
  const parse = (hex: string): number[] => [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) || 0);
  const [r, g, b] = parse(rgb);
  let best: HighlightColor = 'yellow';
  let bestDistance = Infinity;
  for (const [name, hex] of Object.entries(HIGHLIGHT_RGB)) {
    const [r2, g2, b2] = parse(hex);
    const d = ((r ?? 0) - (r2 ?? 0)) ** 2 + ((g ?? 0) - (g2 ?? 0)) ** 2 + ((b ?? 0) - (b2 ?? 0)) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = name as HighlightColor;
    }
  }
  return best;
}

export interface FontEntry {
  name: string;
  family?: string;
}

export function readFontTable(group: RtfGroup): Map<number, FontEntry> {
  const fonts = new Map<number, FontEntry>();
  let index: number | undefined;
  let family: string | undefined;
  let name = '';
  const commit = (): void => {
    if (index !== undefined) fonts.set(index, { name: name.replace(/;\s*$/, '').trim(), family });
    index = undefined;
    family = undefined;
    name = '';
  };
  const visit = (g: RtfGroup, nested: boolean): void => {
    for (const item of g.items) {
      if (item.kind === 'word') {
        if (item.word === 'f' && item.param !== undefined) {
          if (!nested) commit();
          index = item.param;
        } else if (/^f(roman|swiss|modern|script|decor|tech|nil|bidi)$/.test(item.word)) {
          family = item.word.slice(1);
        }
      } else if (item.kind === 'text') {
        name += item.text;
        if (!nested && name.includes(';')) commit();
      } else if (item.kind === 'group') {
        const first = item.items.find((x) => x.kind === 'word' && x.word !== '*');
        if (first?.kind === 'word' && (first.word === 'panose' || first.word === 'falt' || first.word === 'fname')) continue;
        visit(item, false);
        commit();
      }
    }
  };
  visit(group, false);
  commit();
  return fonts;
}

/** Table des couleurs ; l'index 0 vaut « auto ». */
export function readColorTable(group: RtfGroup): string[] {
  const colors: string[] = [];
  let r = -1;
  let g = -1;
  let b = -1;
  for (const item of group.items) {
    if (item.kind === 'word') {
      if (item.word === 'red') r = item.param ?? 0;
      else if (item.word === 'green') g = item.param ?? 0;
      else if (item.word === 'blue') b = item.param ?? 0;
    } else if (item.kind === 'text') {
      for (const ch of item.text) {
        if (ch !== ';') continue;
        const hex = (v: number): string => Math.max(0, Math.min(255, v)).toString(16).toUpperCase().padStart(2, '0');
        colors.push(r < 0 && g < 0 && b < 0 ? 'auto' : `${hex(r)}${hex(g)}${hex(b)}`);
        r = -1;
        g = -1;
        b = -1;
      }
    }
  }
  return colors;
}

function rtfDate(group: RtfGroup): string | undefined {
  const v: Record<string, number> = {};
  for (const item of group.items) if (item.kind === 'word' && item.param !== undefined) v[item.word] = item.param;
  if (!v['yr']) return undefined;
  const p = (n: number | undefined): string => String(n ?? 0).padStart(2, '0');
  return `${v['yr']}-${p(v['mo'] ?? 1)}-${p(v['dy'] ?? 1)}T${p(v['hr'])}:${p(v['min'])}:${p(v['sec'])}Z`;
}

export function readInfo(group: RtfGroup, props: DocumentProperties): void {
  const fields: Record<string, keyof DocumentProperties> = {
    title: 'title', subject: 'subject', author: 'creator', keywords: 'keywords', doccomm: 'description', operator: 'lastModifiedBy',
    company: 'company', manager: 'manager', category: 'category',
  };
  for (const item of group.items) {
    if (item.kind !== 'group') continue;
    const first = item.items.find((x) => x.kind === 'word');
    if (first?.kind !== 'word') continue;
    const key = fields[first.word];
    if (key) {
      const value = groupText(item).trim();
      if (value) (props as unknown as Record<string, string>)[key] = value;
    } else if (first.word === 'creatim') {
      const d = rtfDate(item);
      if (d) props.created = d;
    } else if (first.word === 'revtim') {
      const d = rtfDate(item);
      if (d) props.modified = d;
    }
  }
}

/** Texte de niveau RTF (« \'02\'00. ») en gabarit modele (« %1. »). */
function levelText(raw: string): string {
  if (!raw) return '';
  const length = raw.charCodeAt(0);
  const body = raw.slice(1, 1 + length).replace(/;$/, '');
  let out = '';
  for (const ch of body) {
    const code = ch.charCodeAt(0);
    if (code < 9) out += `%${code + 1}`;
    else if (code === 0xf0b7 || code === 0xb7) out += '•';
    else if (code === 0xf0a7) out += '▪';
    else if (code === 0xf06f) out += 'o';
    else out += ch;
  }
  return out;
}

/** \listtable : listes abstraites, indexees par \listid. */
export function readListTable(group: RtfGroup, firstId: number): Map<number, AbstractNumbering> {
  const lists = new Map<number, AbstractNumbering>();
  let next = firstId;
  for (const list of group.items) {
    if (list.kind !== 'group') continue;
    const abstract: AbstractNumbering = { id: next++, levels: [] };
    let listId = abstract.id;
    for (const item of list.items) {
      if (item.kind === 'word' && item.word === 'listid' && item.param !== undefined) listId = item.param;
      if (item.kind === 'word' && item.word === 'listsimple' && item.param === 1) abstract.multiLevelType = 'singleLevel';
      if (item.kind !== 'group') continue;
      const first = item.items.find((x) => x.kind === 'word');
      if (first?.kind === 'word' && first.word === 'listname') {
        const name = groupText(item).replace(/;$/, '').trim();
        if (name) abstract.name = name;
      }
      if (first?.kind !== 'word' || first.word !== 'listlevel') continue;
      const level: NumberingLevel = { level: abstract.levels.length, format: 'decimal', text: '', start: 1, alignment: 'left', suffix: 'tab' };
      let li: number | undefined;
      let fi: number | undefined;
      for (const w of item.items) {
        if (w.kind === 'word') {
          if ((w.word === 'levelnfc' || w.word === 'levelnfcn') && w.param !== undefined) level.format = NFC_TO_FORMAT[w.param] ?? 'decimal';
          else if (w.word === 'levelstartat' && w.param !== undefined) level.start = w.param;
          else if (w.word === 'leveljc' || w.word === 'leveljcn') level.alignment = w.param === 1 ? 'center' : w.param === 2 ? 'right' : 'left';
          else if (w.word === 'levelfollow') level.suffix = w.param === 1 ? 'space' : w.param === 2 ? 'nothing' : 'tab';
          else if (w.word === 'levellegal' && w.param === 1) level.isLegal = true;
          else if (w.word === 'li' || w.word === 'lin') li = w.param;
          else if (w.word === 'fi') fi = w.param;
        } else if (w.kind === 'group') {
          const head = w.items.find((x) => x.kind === 'word');
          if (head?.kind === 'word' && head.word === 'leveltext') level.text = levelText(groupText(w));
        }
      }
      if (li !== undefined || fi !== undefined) level.paragraph = { indentLeft: twipsToPt(li ?? 0), indentFirstLine: twipsToPt(fi ?? 0) };
      if (level.format === 'bullet' && !level.text) level.text = '•';
      abstract.levels.push(level);
    }
    if (!abstract.multiLevelType) abstract.multiLevelType = abstract.levels.length > 1 ? 'hybridMultilevel' : 'singleLevel';
    lists.set(listId, abstract);
  }
  return lists;
}

/** \listoverridetable : \lsN -> \listid. */
export function readListOverrides(group: RtfGroup): Map<number, number> {
  const out = new Map<number, number>();
  for (const item of group.items) {
    if (item.kind !== 'group') continue;
    let listId: number | undefined;
    let ls: number | undefined;
    for (const w of item.items) {
      if (w.kind === 'word' && w.word === 'listid') listId = w.param;
      if (w.kind === 'word' && w.word === 'ls') ls = w.param;
    }
    if (listId !== undefined && ls !== undefined) out.set(ls, listId);
  }
  return out;
}
