// Analyse des codes de format de nombre Excel (sections, conditions, couleurs, jetons).

export type DateToken =
  | 'y'
  | 'yy'
  | 'yyyy'
  | 'm'
  | 'mm'
  | 'mmm'
  | 'mmmm'
  | 'mmmmm'
  | 'd'
  | 'dd'
  | 'ddd'
  | 'dddd'
  | 'h'
  | 'hh'
  | 'mi'
  | 'mmi'
  | 's'
  | 'ss'
  | '[h]'
  | '[m]'
  | '[s]'
  | 'ampm'
  | 'ap'
  | 'sub';

export type Part =
  | { k: 'lit'; v: string }
  | { k: 'digit'; ch: '0' | '#' | '?' }
  | { k: 'dot' }
  | { k: 'comma' }
  | { k: 'pct' }
  | { k: 'exp'; plus: boolean }
  | { k: 'slash' }
  | { k: 'denom'; v: number }
  | { k: 'text' }
  | { k: 'general' }
  | { k: 'date'; tok: DateToken; width: number; upper?: boolean }
  | { k: 'fill'; ch: string };

export interface Condition {
  op: '<' | '>' | '=' | '<=' | '>=' | '<>';
  value: number;
}

export interface Section {
  parts: Part[];
  color?: string | undefined;
  cond?: Condition | undefined;
  /** Le code contient des jetons date/heure. */
  isDate: boolean;
  /** Section texte (contient '@'). */
  hasText: boolean;
  /** Le code contient au moins un chiffre ou "General". */
  hasNumber: boolean;
  /** Heures sur 12 avec AM/PM. */
  twelveHour: boolean;
  /** Symbole monetaire tire de [$sym-xxx]. */
  currency?: string | undefined;
}

export interface CompiledFormat {
  code: string;
  sections: Section[];
}

const COLOR_NAMES: Record<string, string> = {
  BLACK: '#000000',
  NOIR: '#000000',
  BLUE: '#0000FF',
  BLEU: '#0000FF',
  CYAN: '#00FFFF',
  GREEN: '#00FF00',
  VERT: '#00FF00',
  MAGENTA: '#FF00FF',
  RED: '#FF0000',
  ROUGE: '#FF0000',
  WHITE: '#FFFFFF',
  BLANC: '#FFFFFF',
  YELLOW: '#FFFF00',
  JAUNE: '#FFFF00',
};

/** Palette Excel par defaut (Color1..Color56). */
const PALETTE = (
  '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 ' +
  '9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF ' +
  '00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 ' +
  '003366 339966 003300 333300 993300 993366 333399 333333'
).split(' ');

function colorOf(name: string): string | undefined {
  const up = name.toUpperCase();
  const direct = COLOR_NAMES[up];
  if (direct) return direct;
  const m = up.match(/^(?:COLOR|COULEUR)\s*(\d{1,2})$/);
  if (m) {
    const hex = PALETTE[Number(m[1]) - 1];
    return hex ? `#${hex}` : undefined;
  }
  return undefined;
}

/** Decoupe le code en sections au niveau des ';' non proteges. */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let inBracket = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i] ?? '';
    if (inQuote) {
      cur += ch;
      if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '\\' || ch === '_' || ch === '*') {
      cur += ch + (code[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === '"') inQuote = true;
    else if (ch === '[') inBracket = true;
    else if (ch === ']') inBracket = false;
    else if (ch === ';' && !inBracket) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseBracket(content: string, sec: Section, parts: Part[]): void {
  const c = content.trim();
  const cond = c.match(/^(<=|>=|<>|<|>|=)\s*(-?[\d.]+(?:[eE][+-]?\d+)?)$/);
  if (cond) {
    sec.cond = { op: cond[1] as Condition['op'], value: Number(cond[2]) };
    return;
  }
  const el = c.toLowerCase();
  if (/^h+$/.test(el)) {
    parts.push({ k: 'date', tok: '[h]', width: el.length });
    sec.isDate = true;
    return;
  }
  if (/^m+$/.test(el)) {
    parts.push({ k: 'date', tok: '[m]', width: el.length });
    sec.isDate = true;
    return;
  }
  if (/^s+$/.test(el)) {
    parts.push({ k: 'date', tok: '[s]', width: el.length });
    sec.isDate = true;
    return;
  }
  if (c.startsWith('$')) {
    const dash = c.indexOf('-');
    const sym = dash < 0 ? c.slice(1) : c.slice(1, dash);
    if (sym !== '') {
      parts.push({ k: 'lit', v: sym });
      sec.currency = sym;
    }
    return;
  }
  const color = colorOf(c);
  if (color) sec.color = color;
  // Autres balises ([DBNum1], [$-409]...) ignorees.
}

function parseSection(src: string): Section {
  const sec: Section = { parts: [], isDate: false, hasText: false, hasNumber: false, twelveHour: false };
  const parts = sec.parts;
  const lit = (v: string): void => {
    const last = parts[parts.length - 1];
    if (last && last.k === 'lit') last.v += v;
    else parts.push({ k: 'lit', v });
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i] ?? '';
    const lower = ch.toLowerCase();
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      const stop = end < 0 ? src.length : end;
      lit(src.slice(i + 1, stop));
      i = stop + 1;
      continue;
    }
    if (ch === '\\') {
      lit(src[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (ch === '_') {
      lit(' ');
      i += 2;
      continue;
    }
    if (ch === '*') {
      parts.push({ k: 'fill', ch: src[i + 1] ?? ' ' });
      i += 2;
      continue;
    }
    if (ch === '[') {
      const end = src.indexOf(']', i);
      const stop = end < 0 ? src.length : end;
      parseBracket(src.slice(i + 1, stop), sec, parts);
      i = stop + 1;
      continue;
    }
    const word = src.slice(i, i + 8).toLowerCase();
    if (word.startsWith('general') || word === 'standard') {
      parts.push({ k: 'general' });
      sec.hasNumber = true;
      i += word === 'standard' ? 8 : 7;
      continue;
    }
    if (src.slice(i, i + 5).toUpperCase() === 'AM/PM') {
      parts.push({ k: 'date', tok: 'ampm', width: 5, upper: src[i] === 'A' });
      sec.twelveHour = true;
      sec.isDate = true;
      i += 5;
      continue;
    }
    if (src.slice(i, i + 3).toUpperCase() === 'A/P') {
      parts.push({ k: 'date', tok: 'ap', width: 3, upper: src[i] === 'A' });
      sec.twelveHour = true;
      sec.isDate = true;
      i += 3;
      continue;
    }
    if (ch === '0' || ch === '#' || ch === '?') {
      parts.push({ k: 'digit', ch });
      sec.hasNumber = true;
      i++;
      continue;
    }
    if (ch === '.') {
      // Fractions de seconde : .0, .00, .000 apres des secondes.
      const zeros = src.slice(i + 1).match(/^0+/);
      const prevDate = [...parts].reverse().find((p) => p.k !== 'lit');
      if (zeros && prevDate && prevDate.k === 'date' && (prevDate.tok === 's' || prevDate.tok === 'ss' || prevDate.tok === '[s]')) {
        parts.push({ k: 'date', tok: 'sub', width: zeros[0].length });
        i += 1 + zeros[0].length;
        continue;
      }
      parts.push({ k: 'dot' });
      i++;
      continue;
    }
    if (ch === ',') {
      parts.push({ k: 'comma' });
      i++;
      continue;
    }
    if (ch === '%') {
      parts.push({ k: 'pct' });
      lit('%');
      i++;
      continue;
    }
    if ((ch === 'E' || ch === 'e') && (src[i + 1] === '+' || src[i + 1] === '-')) {
      parts.push({ k: 'exp', plus: src[i + 1] === '+' });
      i += 2;
      continue;
    }
    if (ch === '/') {
      const hasDigitsBefore = parts.some((p) => p.k === 'digit');
      if (hasDigitsBefore && !sec.isDate) {
        parts.push({ k: 'slash' });
        i++;
        // Denominateur fixe : chiffres litteraux.
        const fixed = src.slice(i).match(/^[1-9]\d*/);
        if (fixed) {
          parts.push({ k: 'denom', v: Number(fixed[0]) });
          i += fixed[0].length;
        }
        continue;
      }
      lit('/');
      i++;
      continue;
    }
    if (ch === '@') {
      parts.push({ k: 'text' });
      sec.hasText = true;
      i++;
      continue;
    }
    if ('ymdhs'.includes(lower)) {
      let j = i;
      while (j < src.length && (src[j] ?? '').toLowerCase() === lower) j++;
      const n = j - i;
      sec.isDate = true;
      let tok: DateToken;
      if (lower === 'y') tok = n <= 2 ? 'yy' : 'yyyy';
      else if (lower === 'm') tok = n === 1 ? 'm' : n === 2 ? 'mm' : n === 3 ? 'mmm' : n === 4 ? 'mmmm' : 'mmmmm';
      else if (lower === 'd') tok = n === 1 ? 'd' : n === 2 ? 'dd' : n === 3 ? 'ddd' : 'dddd';
      else if (lower === 'h') tok = n === 1 ? 'h' : 'hh';
      else tok = n === 1 ? 's' : 'ss';
      parts.push({ k: 'date', tok, width: n });
      i = j;
      continue;
    }
    lit(ch);
    i++;
  }
  resolveMinutes(parts);
  if (sec.isDate) sec.hasNumber = false;
  return sec;
}

/** m/mm juste apres une heure ou juste avant des secondes = minutes. */
function resolveMinutes(parts: Part[]): void {
  const dateIdx: number[] = [];
  parts.forEach((p, idx) => {
    if (p.k === 'date') dateIdx.push(idx);
  });
  for (let n = 0; n < dateIdx.length; n++) {
    const p = parts[dateIdx[n] ?? -1];
    if (!p || p.k !== 'date' || (p.tok !== 'm' && p.tok !== 'mm')) continue;
    const prev = parts[dateIdx[n - 1] ?? -1];
    const next = parts[dateIdx[n + 1] ?? -1];
    const afterHour = prev?.k === 'date' && (prev.tok === 'h' || prev.tok === 'hh' || prev.tok === '[h]');
    const beforeSec = next?.k === 'date' && (next.tok === 's' || next.tok === 'ss' || next.tok === '[s]');
    if (afterHour || beforeSec) p.tok = p.tok === 'm' ? 'mi' : 'mmi';
  }
}

const cache = new Map<string, CompiledFormat>();

/** Compile un code de format (resultat mis en cache). */
export function compileFormat(code: string): CompiledFormat {
  const hit = cache.get(code);
  if (hit) return hit;
  const raw = code.trim() === '' || /^(general|standard)$/i.test(code.trim()) ? 'General' : code;
  const sections = splitSections(raw).slice(0, 4).map(parseSection);
  const compiled: CompiledFormat = { code, sections };
  if (cache.size > 2000) cache.clear();
  cache.set(code, compiled);
  return compiled;
}

/** Le format affiche-t-il une date ou une heure ? */
export function isDateFormat(code: string): boolean {
  return compileFormat(code).sections[0]?.isDate ?? false;
}
