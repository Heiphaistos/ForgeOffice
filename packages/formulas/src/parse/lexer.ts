// Decoupage lexical d'une formule (syntaxe canonique ou francaise), avec positions dans le texte source.
import { MAX_COLS, MAX_ROWS, lettersToCol } from '../refs.ts';
import { STRINGS } from '../strings.ts';
import type { ErrorCode } from '../values.ts';
import type { RefNode, TableNode, TableSpecial } from './ast.ts';
import type { FormulaSyntax } from './syntax.ts';

interface Span {
  s: number;
  e: number;
}

export type Token = Span &
  (
    | { t: 'num'; v: number }
    | { t: 'str'; v: string }
    | { t: 'bool'; v: boolean }
    | { t: 'err'; v: ErrorCode }
    | { t: 'ref'; ref: RefNode }
    | { t: 'name'; v: string; sheet?: string | undefined }
    | { t: 'func'; v: string; raw: string }
    | { t: 'table'; table: TableNode }
    | { t: 'op'; v: string }
    | { t: '(' }
    | { t: ')' }
    | { t: 'sep' }
    | { t: '{' }
    | { t: '}' }
    | { t: 'arow' }
    | { t: 'acol' }
    | { t: 'ws' }
  );

export class FormulaParseError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'FormulaParseError';
    this.position = position;
  }
}

const IDENT_CHAR = /[A-Za-z0-9_.\\?¡-￿]/;
const IDENT_START = /[A-Za-z_\\¡-￿]/;
const RE_AREA = /\$?([A-Za-z]{1,3})\$?(\d{1,7}):\$?([A-Za-z]{1,3})\$?(\d{1,7})/y;
const RE_COLS = /(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})/y;
const RE_ROWS = /(\$?)(\d{1,7}):(\$?)(\d{1,7})/y;
const RE_CELL = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/y;
const RE_SHEET = /([A-Za-z_¡-￿][A-Za-z0-9_.¡-￿]*)(?::([A-Za-z_¡-￿][A-Za-z0-9_.¡-￿]*))?!/y;
const RE_IDENT = /[A-Za-z_\\¡-￿][A-Za-z0-9_.\\?¡-￿]*/y;
const RE_BOOK = /\[[^\]\[]+\]/y;

function sticky(re: RegExp, src: string, i: number): RegExpMatchArray | null {
  re.lastIndex = i;
  const m = src.match(re);
  return m && re.lastIndex === i + m[0].length ? m : null;
}

/** La correspondance s'arrete-t-elle sur une frontiere (pas de suite d'identifiant ni d'appel) ? */
function boundary(src: string, i: number): boolean {
  const ch = src[i];
  return ch === undefined || !(IDENT_CHAR.test(ch) || ch === '(' || ch === '[' || ch === '!' || ch === '$');
}

function cellParts(colTxt: string, rowTxt: string): { r: number; c: number } | undefined {
  const c = lettersToCol(colTxt);
  const r = Number(rowTxt) - 1;
  if (c < 0 || r < 0 || r >= MAX_ROWS) return undefined;
  return { r, c };
}

interface RefMatch {
  ref: RefNode;
  end: number;
}

/** Essaie de lire une reference (cellule, plage, colonnes, lignes) a la position i. */
function readRef(src: string, i: number): RefMatch | undefined {
  let m = sticky(RE_AREA, src, i);
  if (m && boundary(src, i + m[0].length)) {
    const txt = m[0];
    const [left = '', right = ''] = txt.split(':');
    const a = cellParts(m[1] ?? '', m[2] ?? '');
    const b = cellParts(m[3] ?? '', m[4] ?? '');
    if (a && b) {
      const la = left.lastIndexOf('$') > 0;
      const lb = right.lastIndexOf('$') > 0;
      return {
        end: i + txt.length,
        ref: {
          type: 'ref',
          kind: 'area',
          r1: a.r,
          c1: a.c,
          r2: b.r,
          c2: b.c,
          ac1: left.startsWith('$'),
          ar1: la,
          ac2: right.startsWith('$'),
          ar2: lb,
        },
      };
    }
  }
  m = sticky(RE_COLS, src, i);
  if (m && boundary(src, i + m[0].length)) {
    const c1 = lettersToCol(m[2] ?? '');
    const c2 = lettersToCol(m[4] ?? '');
    if (c1 >= 0 && c2 >= 0) {
      return {
        end: i + m[0].length,
        ref: {
          type: 'ref',
          kind: 'cols',
          r1: 0,
          c1,
          r2: MAX_ROWS - 1,
          c2,
          ar1: false,
          ar2: false,
          ac1: m[1] === '$',
          ac2: m[3] === '$',
        },
      };
    }
  }
  m = sticky(RE_ROWS, src, i);
  if (m && boundary(src, i + m[0].length)) {
    const r1 = Number(m[2]) - 1;
    const r2 = Number(m[4]) - 1;
    if (r1 >= 0 && r2 >= 0 && r1 < MAX_ROWS && r2 < MAX_ROWS) {
      return {
        end: i + m[0].length,
        ref: {
          type: 'ref',
          kind: 'rows',
          r1,
          c1: 0,
          r2,
          c2: MAX_COLS - 1,
          ar1: m[1] === '$',
          ar2: m[3] === '$',
          ac1: false,
          ac2: false,
        },
      };
    }
  }
  m = sticky(RE_CELL, src, i);
  if (m && boundary(src, i + m[0].length)) {
    const p = cellParts(m[2] ?? '', m[4] ?? '');
    if (p) {
      return {
        end: i + m[0].length,
        ref: {
          type: 'ref',
          kind: 'cell',
          r1: p.r,
          c1: p.c,
          r2: p.r,
          c2: p.c,
          ac1: m[1] === '$',
          ar1: m[3] === '$',
          ac2: m[1] === '$',
          ar2: m[3] === '$',
        },
      };
    }
  }
  return undefined;
}

interface SheetPrefix {
  sheet: string;
  sheet2?: string | undefined;
  book?: string | undefined;
  end: number;
}

function readSheetPrefix(src: string, i: number): SheetPrefix | undefined {
  let j = i;
  let book: string | undefined;
  const bm = sticky(RE_BOOK, src, j);
  if (bm) {
    book = bm[0];
    j += bm[0].length;
  }
  if (src[j] === "'") {
    let k = j + 1;
    let name = '';
    for (;;) {
      const ch = src[k];
      if (ch === undefined) return undefined;
      if (ch === "'") {
        if (src[k + 1] === "'") {
          name += "'";
          k += 2;
          continue;
        }
        break;
      }
      name += ch;
      k++;
    }
    if (src[k + 1] !== '!') return undefined;
    let inner = name;
    if (!book) {
      const ib = inner.match(/^\[[^\]]+\]/);
      if (ib) {
        book = ib[0];
        inner = inner.slice(ib[0].length);
      }
    }
    const parts = inner.split(':');
    return { sheet: parts[0] ?? '', sheet2: parts[1], book, end: k + 2 };
  }
  const m = sticky(RE_SHEET, src, j);
  if (!m) return undefined;
  return { sheet: m[1] ?? '', sheet2: m[2], book, end: j + m[0].length };
}

function readQuotedTableItem(src: string, i: number): { text: string; end: number } {
  // src[i] est le caractere apres '[' ; lit jusqu'au ']' non echappe (echappement par apostrophe).
  let k = i;
  let text = '';
  for (;;) {
    const ch = src[k];
    if (ch === undefined) throw new FormulaParseError(STRINGS.parse.unclosedBracket, i);
    if (ch === "'") {
      text += src[k + 1] ?? '';
      k += 2;
      continue;
    }
    if (ch === ']') return { text, end: k + 1 };
    text += ch;
    k++;
  }
}

function readTableSpec(src: string, i: number, table: string, syntax: FormulaSyntax): { node: TableNode; end: number } {
  // src[i] === '['
  const node: TableNode = { type: 'table', table, specials: [] };
  const addItem = (text: string, pos: number): void => {
    const trimmed = text.trim();
    if (trimmed.startsWith('#')) {
      const sp: TableSpecial | undefined = syntax.tableIn(trimmed);
      if (!sp) throw new FormulaParseError(STRINGS.parse.badTableItem, pos);
      node.specials.push(sp);
    } else if (node.col1 === undefined) node.col1 = text;
    else node.col2 = text;
  };
  let k = i + 1;
  while (src[k] === ' ') k++;
  if (src[k] === '[') {
    for (;;) {
      while (src[k] === ' ') k++;
      if (src[k] !== '[') throw new FormulaParseError(STRINGS.parse.badTableItem, k);
      const item = readQuotedTableItem(src, k + 1);
      addItem(item.text, k);
      k = item.end;
      while (src[k] === ' ') k++;
      const ch = src[k];
      if (ch === ']') return { node, end: k + 1 };
      if (ch === ':' || ch === syntax.argSep || ch === ',') {
        k++;
        continue;
      }
      throw new FormulaParseError(STRINGS.parse.badTableItem, k);
    }
  }
  if (src[k] === '@') {
    node.specials.push('#This Row');
    k++;
    if (src[k] === '[') {
      const item = readQuotedTableItem(src, k + 1);
      addItem(item.text, k);
      k = item.end;
      if (src[k] !== ']') throw new FormulaParseError(STRINGS.parse.unclosedBracket, k);
      return { node, end: k + 1 };
    }
    const item = readQuotedTableItem(src, k);
    if (item.text !== '') addItem(item.text, k);
    return { node, end: item.end };
  }
  const item = readQuotedTableItem(src, k);
  if (item.text !== '') addItem(item.text, k);
  return { node, end: item.end };
}

/** Decoupe `src` (sans le '=' initial) en jetons. */
export function tokenize(src: string, syntax: FormulaSyntax): Token[] {
  const out: Token[] = [];
  const numRe = syntax.decimal === ','
    ? /(\d+(,\d*)?|,\d+)([eE][+-]?\d+)?/y
    : /(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/y;
  let i = 0;
  let braces = 0;
  const lastSignificant = (): Token | undefined => {
    for (let k = out.length - 1; k >= 0; k--) if (out[k]?.t !== 'ws') return out[k];
    return undefined;
  };
  while (i < src.length) {
    const ch = src[i] ?? '';
    const s = i;
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ') {
      while (i < src.length && /[ \n\r\t ]/.test(src[i] ?? '')) i++;
      out.push({ t: 'ws', s, e: i });
      continue;
    }
    if (ch === '"') {
      let k = i + 1;
      let v = '';
      for (;;) {
        const c = src[k];
        if (c === undefined) throw new FormulaParseError(STRINGS.parse.unclosedString, s);
        if (c === '"') {
          if (src[k + 1] === '"') {
            v += '"';
            k += 2;
            continue;
          }
          break;
        }
        v += c;
        k++;
      }
      i = k + 1;
      out.push({ t: 'str', v, s, e: i });
      continue;
    }
    if (braces > 0) {
      if (ch === syntax.arrayRow) {
        out.push({ t: 'arow', s, e: ++i });
        continue;
      }
      if (ch === syntax.arrayCol || syntax.arrayColAlt.includes(ch)) {
        out.push({ t: 'acol', s, e: ++i });
        continue;
      }
    }
    if (ch === '{') {
      braces++;
      out.push({ t: '{', s, e: ++i });
      continue;
    }
    if (ch === '}') {
      braces = Math.max(0, braces - 1);
      out.push({ t: '}', s, e: ++i });
      continue;
    }
    if (ch === '(') {
      out.push({ t: '(', s, e: ++i });
      continue;
    }
    if (ch === ')') {
      out.push({ t: ')', s, e: ++i });
      continue;
    }
    if (ch === syntax.argSep) {
      out.push({ t: 'sep', s, e: ++i });
      continue;
    }
    if (ch === '#') {
      const prev = lastSignificant();
      const prevIsRef = prev !== undefined && prev.e === i &&
        (prev.t === 'ref' || prev.t === 'name' || prev.t === ')');
      if (prevIsRef) {
        out.push({ t: 'op', v: '#', s, e: ++i });
        continue;
      }
      const up = src.slice(i, i + 20).toUpperCase();
      const hit = syntax.errorsIn.find(([txt]) => up.startsWith(txt.toUpperCase()));
      if (!hit) throw new FormulaParseError(STRINGS.parse.unknownError, s);
      i += hit[0].length;
      if (hit[1] === '#REF!') {
        const r = readRef(src, i);
        if (r) {
          r.ref.sheetError = true;
          i = r.end;
          out.push({ t: 'ref', ref: r.ref, s, e: i });
          continue;
        }
      }
      out.push({ t: 'err', v: hit[1], s, e: i });
      continue;
    }
    if (ch === '<' || ch === '>') {
      const two = src.slice(i, i + 2);
      if (two === '<>' || two === '<=' || two === '>=') {
        i += 2;
        out.push({ t: 'op', v: two, s, e: i });
        continue;
      }
    }
    if ('+-*/^&=<>%:@'.includes(ch)) {
      out.push({ t: 'op', v: ch, s, e: ++i });
      continue;
    }
    // Prefixe de feuille / classeur.
    if (ch === "'" || ch === '[' || IDENT_START.test(ch)) {
      const sp = readSheetPrefix(src, i);
      if (sp) {
        const after = sp.end;
        if (src.slice(after, after + 5).toUpperCase() === '#REF!') {
          i = after + 5;
          out.push({ t: 'err', v: '#REF!', s, e: i });
          continue;
        }
        const r = readRef(src, after);
        if (r) {
          r.ref.sheet = sp.sheet;
          r.ref.sheet2 = sp.sheet2;
          r.ref.book = sp.book;
          i = r.end;
          out.push({ t: 'ref', ref: r.ref, s, e: i });
          continue;
        }
        const nm = sticky(RE_IDENT, src, after);
        if (nm) {
          i = after + nm[0].length;
          out.push({ t: 'name', v: nm[0], sheet: sp.sheet, s, e: i });
          continue;
        }
        throw new FormulaParseError(STRINGS.parse.badReference, s);
      }
    }
    if (ch === '[') {
      const tb = readTableSpec(src, i, '', syntax);
      i = tb.end;
      out.push({ t: 'table', table: tb.node, s, e: i });
      continue;
    }
    const r = readRef(src, i);
    if (r) {
      i = r.end;
      out.push({ t: 'ref', ref: r.ref, s, e: i });
      continue;
    }
    const nm = sticky(numRe, src, i);
    if (nm && nm[0] !== syntax.decimal) {
      const txt = nm[0].replace(syntax.decimal, '.');
      i += nm[0].length;
      out.push({ t: 'num', v: Number(txt), s, e: i });
      continue;
    }
    const id = sticky(RE_IDENT, src, i);
    if (id) {
      const raw = id[0];
      i += raw.length;
      if (src[i] === '(') {
        out.push({ t: 'func', v: syntax.funcIn(raw), raw, s, e: i });
        continue;
      }
      if (src[i] === '[') {
        const tb = readTableSpec(src, i, raw, syntax);
        i = tb.end;
        out.push({ t: 'table', table: tb.node, s, e: i });
        continue;
      }
      const up = raw.toUpperCase();
      if (up === syntax.trueName || up === syntax.falseName) {
        out.push({ t: 'bool', v: up === syntax.trueName, s, e: i });
        continue;
      }
      out.push({ t: 'name', v: raw, s, e: i });
      continue;
    }
    throw new FormulaParseError(STRINGS.parse.unexpectedChar.replace('{0}', ch), s);
  }
  return out;
}
