// Lecture rapide de « sheetData » : balayage direct du texte (sans arbre XML complet), ligne par ligne.
// Chaque ligne est livree comme un petit element XML (row > c > v/f/is) au lecteur de cellules.
import { parseXml, type XmlElement } from '@forgeoffice/opc';

const ENTITIES: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(raw: string): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref.startsWith('#')) {
      const code = ref.startsWith('#x') ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}

/** Attributs d'une balise (« c r="A1" s="2" ») par balayage direct (bien plus rapide qu'une expression globale). */
function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = tag.indexOf(' ');
  if (i < 0) return attrs;
  const len = tag.length;
  while (i < len) {
    while (i < len && tag.charCodeAt(i) <= 32) i++;
    const eq = tag.indexOf('=', i);
    if (eq < 0) break;
    const name = tag.slice(i, eq).trim();
    let q = eq + 1;
    while (q < len && tag.charCodeAt(q) <= 32) q++;
    const quote = tag.charAt(q);
    if (quote !== '"' && quote !== "'") break;
    const close = tag.indexOf(quote, q + 1);
    if (close < 0) break;
    attrs[name] = decode(tag.slice(q + 1, close));
    i = close + 1;
  }
  return attrs;
}

/** Fin de balise (« > ») en sautant les valeurs d'attribut citees. */
function tagEnd(xml: string, from: number): number {
  let quote = '';
  for (let i = from; i < xml.length; i++) {
    const ch = xml.charCodeAt(i);
    if (quote) {
      if (xml.charAt(i) === quote) quote = '';
    } else if (ch === 62) {
      return i;
    } else if (ch === 34 || ch === 39) {
      quote = xml.charAt(i);
    }
  }
  return -1;
}

export interface SheetDataSplit {
  /** XML de la feuille avec un « sheetData » vide (petit, analyse en arbre). */
  rest: string;
  /** Position du contenu de sheetData dans le texte d'origine. */
  start: number;
  end: number;
}

/** Isole le contenu de « sheetData » ; undefined si absent ou vide. */
export function splitSheetData(xml: string): SheetDataSplit | undefined {
  const open = xml.match(/<([A-Za-z_][\w.-]*:)?sheetData(?=[\s/>])/);
  if (!open || open.index === undefined) return undefined;
  const prefix = open[1] ?? '';
  const gt = tagEnd(xml, open.index);
  if (gt < 0 || xml.charAt(gt - 1) === '/') return undefined;
  const close = xml.indexOf(`</${prefix}sheetData>`, gt);
  if (close < 0) return undefined;
  return {
    rest: `${xml.slice(0, open.index)}<${prefix}sheetData/>${xml.slice(close + prefix.length + 12)}`,
    start: gt + 1,
    end: close,
  };
}

function localOf(qualified: string): string {
  const colon = qualified.indexOf(':');
  return colon < 0 ? qualified : qualified.slice(colon + 1);
}

/** Balaye le contenu de sheetData et appelle `onRow` pour chaque ligne complete. */
export function scanSheetData(xml: string, start: number, end: number, onRow: (row: XmlElement) => void): void {
  let i = start;
  let row: XmlElement | undefined;
  let cell: XmlElement | undefined;
  while (i < end) {
    const lt = xml.indexOf('<', i);
    if (lt < 0 || lt >= end) break;
    const gt = tagEnd(xml, lt + 1);
    if (gt < 0) break;
    const raw = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.charCodeAt(0) === 47) {
      const name = localOf(raw.slice(1).trim());
      if (name === 'c') cell = undefined;
      else if (name === 'row') {
        if (row) onRow(row);
        row = undefined;
      }
      continue;
    }
    if (raw.charCodeAt(0) === 33 || raw.charCodeAt(0) === 63) continue;
    const selfClosing = raw.charCodeAt(raw.length - 1) === 47;
    const space = raw.search(/[\s/]/);
    const qualified = space < 0 ? raw : raw.slice(0, space);
    const name = localOf(qualified);
    if (name === 'row') {
      if (row) onRow(row);
      row = { name: 'row', attrs: parseAttrs(raw), children: [] };
      if (selfClosing) {
        onRow(row);
        row = undefined;
      }
    } else if (name === 'c') {
      cell = { name: 'c', attrs: parseAttrs(raw), children: [] };
      row?.children.push(cell);
      if (selfClosing) cell = undefined;
    } else if (cell && (name === 'v' || name === 'f')) {
      const node: XmlElement = { name, attrs: parseAttrs(raw), children: [] };
      if (!selfClosing) {
        const close = xml.indexOf(`</${qualified}>`, i);
        if (close < 0 || close > end) break;
        let text = xml.slice(i, close);
        if (text.startsWith('<![CDATA[') && text.endsWith(']]>')) text = text.slice(9, -3);
        else text = decode(text);
        node.children.push(text);
        i = close + qualified.length + 3;
      }
      cell.children.push(node);
    } else if (cell && name === 'is' && !selfClosing) {
      const close = xml.indexOf(`</${qualified}>`, i);
      if (close < 0 || close > end) break;
      cell.children.push(parseXml(xml.slice(lt, close + qualified.length + 3)));
      i = close + qualified.length + 3;
    }
  }
  if (row) onRow(row);
}
