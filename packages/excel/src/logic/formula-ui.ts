// Aide a la saisie des formules en francais : references colorees, saisie semi-automatique des fonctions,
// info-bulle des arguments (fonction et argument courants), insertion de references en mode Pointer.
import { functionNameFromFr, functionNameToFr, getFunction, listFunctions, type Category } from '@forgeoffice/formulas';
import { columnIndex, MAX_COLS, MAX_ROWS, type CellRange } from '@forgeoffice/xlsx';
import { FN_HELP } from './fn-help.ts';

/** Couleurs des references (ordre d'Excel 2024). */
export const REF_COLORS = ['#3B6FD8', '#C0392B', '#8E44AD', '#1E8449', '#B9770E', '#2E86C1', '#A93226', '#117A65'] as const;

export interface RefMark {
  start: number;
  end: number;
  text: string;
  /** Feuille explicite (sinon feuille de la formule). */
  sheet?: string;
  range: CellRange;
  color: string;
}

const REF_RE = /(?:(?:'((?:[^']|'')+)'|([A-Za-z_À-￿][\w.À-￿]*))!)?(\$?[A-Za-z]{1,3}\$?\d{1,7}(?::\$?[A-Za-z]{1,3}\$?\d{1,7})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d{1,7}:\$?\d{1,7})(?![\w(!])/g;

function parsePart(part: string): CellRange | undefined {
  const p = part.replace(/\$/g, '');
  const [a = '', b = a] = p.split(':');
  const cell = /^([A-Za-z]{1,3})(\d{1,7})$/;
  const ma = a.match(cell);
  const mb = b.match(cell);
  if (ma && mb) {
    const c1 = columnIndex(ma[1] ?? '');
    const c2 = columnIndex(mb[1] ?? '');
    const r1 = Number(ma[2]) - 1;
    const r2 = Number(mb[2]) - 1;
    if (c1 < 0 || c2 < 0 || r1 < 0 || r2 < 0 || c1 >= MAX_COLS || c2 >= MAX_COLS || r1 >= MAX_ROWS || r2 >= MAX_ROWS) return undefined;
    return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
  }
  if (/^[A-Za-z]{1,3}$/.test(a) && /^[A-Za-z]{1,3}$/.test(b)) {
    const c1 = columnIndex(a);
    const c2 = columnIndex(b);
    if (c1 < 0 || c2 < 0 || c1 >= MAX_COLS || c2 >= MAX_COLS) return undefined;
    return { r1: 0, c1: Math.min(c1, c2), r2: MAX_ROWS - 1, c2: Math.max(c1, c2) };
  }
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const r1 = Number(a) - 1;
    const r2 = Number(b) - 1;
    if (r1 < 0 || r2 < 0) return undefined;
    return { r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: MAX_COLS - 1 };
  }
  return undefined;
}

/** Positions des chaines de texte (les references n'y sont pas reconnues). */
function stringSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    if (start < 0) start = i;
    else if (text[i + 1] === '"') i++;
    else {
      spans.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) spans.push([start, text.length]);
  return spans;
}

/** References d'une formule en cours de saisie, colorees dans l'ordre d'apparition (meme texte = meme couleur). */
export function findRefs(text: string): RefMark[] {
  if (!text.startsWith('=')) return [];
  const spans = stringSpans(text);
  const colorOf = new Map<string, string>();
  const out: RefMark[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const start = m.index ?? 0;
    if (spans.some(([a, b]) => start > a && start < b)) continue;
    const before = text[start - 1];
    if (before && /[\w.]/.test(before)) continue;
    const range = parsePart(m[3] ?? '');
    if (!range) continue;
    const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
    const key = `${sheet ?? ''}!${(m[3] ?? '').replace(/\$/g, '').toUpperCase()}`;
    let color = colorOf.get(key);
    if (!color) {
      color = REF_COLORS[colorOf.size % REF_COLORS.length] ?? REF_COLORS[0];
      colorOf.set(key, color);
    }
    out.push({ start, end: start + m[0].length, text: m[0], ...(sheet ? { sheet } : {}), range, color });
  }
  return out;
}

/** Vrai si le curseur est a une position ou un clic sur la grille insere une reference (mode Pointer). */
export function canPointAt(text: string, caret: number): boolean {
  if (!text.startsWith('=')) return false;
  const before = text.slice(0, caret).trimEnd();
  if (before.length === 0) return false;
  if (stringSpans(text).some(([a, b]) => caret > a && caret <= b)) return false;
  return /[=(;+\-*/^&<>:,{]$/.test(before);
}

/** Reference immediatement avant le curseur (pour la remplacer en mode Pointer). */
export function refBeforeCaret(text: string, caret: number): { start: number; end: number } | null {
  for (const r of findRefs(text)) if (r.end === caret) return { start: r.start, end: r.end };
  return null;
}

// ---------------------------------------------------------------- Fonctions

export interface FnInfo {
  /** Nom francais affiche. */
  name: string;
  canonical: string;
  category: Category;
  args: readonly string[];
  description: string;
}

let catalog: FnInfo[] | null = null;

/** Toutes les fonctions du moteur, avec nom francais, arguments et description. */
export function functionCatalog(): FnInfo[] {
  if (catalog) return catalog;
  catalog = listFunctions()
    .filter((f) => !f.name.startsWith('_') && !f.name.includes('_xl'))
    .map((f) => {
      const name = functionNameToFr(f.name);
      const help = FN_HELP[name];
      return { name, canonical: f.name, category: f.category, args: help?.args ?? genericArgs(f.min, f.max), description: help?.d ?? '' };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return catalog;
}

function genericArgs(min: number, max: number): string[] {
  const out: string[] = [];
  const shown = Math.min(Math.max(min, 1), 4);
  for (let i = 1; i <= shown; i++) out.push(i <= min ? `valeur${i}` : `[valeur${i}]`);
  if (max > shown) out.push('...');
  return out;
}

export function functionInfo(frName: string): FnInfo | undefined {
  const up = frName.toUpperCase();
  return functionCatalog().find((f) => f.name === up) ?? (getFunction(functionNameFromFr(up)) ? functionCatalog().find((f) => f.canonical === functionNameFromFr(up)) : undefined);
}

/** Mot en cours de saisie avant le curseur s'il peut etre un debut de nom de fonction. */
export function wordAtCaret(text: string, caret: number): { start: number; word: string } | null {
  if (!text.startsWith('=')) return null;
  if (stringSpans(text).some(([a, b]) => caret > a && caret <= b)) return null;
  const m = text.slice(0, caret).match(/([A-Za-zÀ-ÿ][A-Za-z0-9.À-ÿ]*)$/);
  if (!m || m.index === undefined) return null;
  const prev = text[m.index - 1];
  if (prev && /[\w!$:']/.test(prev)) return null;
  return { start: m.index, word: m[1] ?? '' };
}

/** Fonctions dont le nom commence par le mot saisi (saisie semi-automatique). */
export function completions(word: string, limit = 12): FnInfo[] {
  if (!word) return [];
  const up = word.toUpperCase();
  const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const f = fold(up);
  return functionCatalog().filter((x) => fold(x.name).startsWith(f)).slice(0, limit);
}

/** Fonction et rang de l'argument ou se trouve le curseur (info-bulle « SOMME(nombre1; [nombre2]; ...) »). */
export function argumentAt(text: string, caret: number): { fn: string; index: number } | null {
  if (!text.startsWith('=')) return null;
  const stack: { fn: string; index: number }[] = [];
  let inStr = false;
  for (let i = 0; i < caret && i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === '(') {
      const m = text.slice(0, i).match(/([A-Za-zÀ-ÿ][A-Za-z0-9.À-ÿ]*)\s*$/);
      stack.push({ fn: m?.[1]?.toUpperCase() ?? '', index: 0 });
    } else if (ch === ')') stack.pop();
    else if (ch === ';') {
      const top = stack[stack.length - 1];
      if (top) top.index++;
    }
  }
  for (let k = stack.length - 1; k >= 0; k--) {
    const s = stack[k];
    if (s && s.fn) return s;
  }
  return null;
}

/** Arguments a afficher pour un rang donne (les arguments repetes « ... » sont numerotes). */
export function argLabel(info: FnInfo, index: number): { parts: string[]; current: number } {
  const parts = [...info.args];
  const ell = parts.indexOf('...');
  let current = Math.min(index, parts.length - 1);
  if (ell >= 0 && index >= ell) current = ell - 1;
  return { parts, current };
}

/** F4 : fait tourner $A$1 -> A$1 -> $A1 -> A1 sur la reference au curseur ; null si le curseur n'est pas sur une reference. */
export function cycleAbsoluteAt(text: string, caret: number): { text: string; caret: number } | null {
  const r = findRefs(text).find((x) => caret >= x.start && caret <= x.end);
  if (!r) return null;
  const cycle = (part: string): string => {
    const m = part.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
    if (!m) return part;
    const state = (m[1] ? 2 : 0) + (m[3] ? 1 : 0);
    const next = [3, 0, 1, 2][state] ?? 3;
    return `${next & 2 ? '$' : ''}${m[2]}${next & 1 ? '$' : ''}${m[4]}`;
  };
  const bang = r.text.lastIndexOf('!');
  const prefix = bang >= 0 ? r.text.slice(0, bang + 1) : '';
  const body = r.text.slice(prefix.length).split(':').map(cycle).join(':');
  return { text: text.slice(0, r.start) + prefix + body + text.slice(r.end), caret: r.start + prefix.length + body.length };
}
