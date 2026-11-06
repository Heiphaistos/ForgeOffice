// Poignee de recopie : series de nombres (tendance lineaire), dates, listes francaises (jours, mois),
// texte suivi d'un nombre (« Trimestre 1 »), formules translatees, motifs repetes.
import { translateFormula } from '@forgeoffice/formulas';
import type { Sheet, Cell, CellRange } from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';

/** Listes personnalisees integrees (Fichier > Options > Listes personnalisees d'Excel en francais). */
export const FILL_LISTS: readonly (readonly string[])[] = [
  ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
  ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  ['T1', 'T2', 'T3', 'T4'],
  ['Trim 1', 'Trim 2', 'Trim 3', 'Trim 4'],
];

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function findList(text: string): { list: readonly string[]; index: number } | undefined {
  const t = fold(text.trim());
  for (const list of FILL_LISTS) {
    const index = list.findIndex((item) => fold(item) === t);
    if (index >= 0) return { list, index };
  }
  return undefined;
}

/** Reproduit la casse de `model` (MAJUSCULES, Capitale, minuscules). */
function matchCase(model: string, value: string): string {
  if (model === model.toUpperCase() && model !== model.toLowerCase()) return value.toUpperCase();
  const first = model.charAt(0);
  if (first === first.toUpperCase() && first !== first.toLowerCase()) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

const TEXT_NUM = /^(.*?)(\d+)(\D*)$/;

type Kind =
  | { k: 'number'; v: number }
  | { k: 'list'; list: readonly string[]; index: number; model: string }
  | { k: 'textnum'; prefix: string; n: number; suffix: string; width: number }
  | { k: 'other' };

function kindOf(cell: Cell | undefined): Kind {
  if (!cell || cell.formula !== undefined) return { k: 'other' };
  const v = cell.value;
  if (typeof v === 'number') return { k: 'number', v };
  if (typeof v === 'string') {
    const l = findList(v);
    if (l) return { k: 'list', list: l.list, index: l.index, model: v };
    const m = v.match(TEXT_NUM);
    if (m && m[2] !== undefined) return { k: 'textnum', prefix: m[1] ?? '', n: Number(m[2]), suffix: m[3] ?? '', width: m[2].startsWith('0') ? m[2].length : 0 };
  }
  return { k: 'other' };
}

/** Pente et ordonnee de la droite des moindres carres (x = 0..n-1). */
function linear(values: readonly number[]): { a: number; b: number } {
  const n = values.length;
  const mx = (n - 1) / 2;
  const my = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    num += (i - mx) * (v - my);
    den += (i - mx) ** 2;
  });
  const a = den === 0 ? 0 : num / den;
  return { a, b: my - a * mx };
}

/** Arrondi d'affichage : evite 0.30000000000000004 dans les series decimales. */
function clean(x: number): number {
  return Number.parseFloat(x.toPrecision(15));
}

export interface SeriesOptions {
  /** Ctrl pendant la recopie : copie sans incrementer. */
  copyOnly?: boolean;
  /** Vrai si la cellule affiche une date (une date seule avance d'un jour, un nombre seul est copie). */
  isDate?: (cell: Cell) => boolean;
}

/**
 * Prolonge une serie source de `count` cellules. Chaque resultat indique la cellule source (`from`)
 * dont il derive, pour translater les formules.
 */
export function extendSeries(source: readonly (Cell | undefined)[], count: number, opt: SeriesOptions = {}): { cell: Cell | undefined; from: number }[] {
  const n = source.length;
  const kinds = source.map(kindOf);
  const out: { cell: Cell | undefined; from: number }[] = [];
  if (!opt.copyOnly && n >= 1 && kinds.every((k) => k.k === 'number')) {
    const vals = kinds.map((k) => (k.k === 'number' ? k.v : 0));
    const first = source[0];
    const single = n === 1;
    const isDate = single && first !== undefined && (opt.isDate?.(first) ?? false);
    const { a, b } = single ? { a: isDate ? 1 : 0, b: vals[0] ?? 0 } : linear(vals);
    for (let i = 0; i < count; i++) {
      const from = i % n;
      const base = source[from];
      if (base) out.push({ cell: { ...base, value: clean(a * (n + i) + b) }, from });
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    const from = i % n;
    const cycle = Math.floor(i / n) + 1;
    const base = source[from];
    const k = kinds[from] ?? { k: 'other' };
    if (opt.copyOnly || !base) out.push({ cell: base, from });
    else if (k.k === 'list') {
      const step = listStep(kinds, k);
      const len = k.list.length;
      const idx = (((k.index + step * cycle) % len) + len) % len;
      out.push({ cell: { ...base, value: matchCase(k.model, k.list[idx] ?? '') }, from });
    } else if (k.k === 'textnum') {
      const num = String(Math.max(0, k.n + textStep(kinds, k) * cycle));
      out.push({ cell: { ...base, value: `${k.prefix}${k.width ? num.padStart(k.width, '0') : num}${k.suffix}` }, from });
    } else out.push({ cell: base, from });
  }
  return out;
}

/** Avance d'une liste par cycle : un element seul avance de 1, plusieurs de (dernier - premier + ecart). */
function listStep(kinds: readonly Kind[], k: Kind & { k: 'list' }): number {
  const same = kinds.filter((x): x is Kind & { k: 'list' } => x.k === 'list' && x.list === k.list);
  const first = same[0];
  const second = same[1];
  if (!first || !second) return 1;
  const len = k.list.length;
  const diff = (second.index - first.index + len) % len || 1;
  return diff * same.length;
}

/** Avance d'un texte numerote par cycle (ecart moyen x nombre d'elements de meme motif). */
function textStep(kinds: readonly Kind[], k: Kind & { k: 'textnum' }): number {
  const same = kinds.filter((x): x is Kind & { k: 'textnum' } => x.k === 'textnum' && x.prefix === k.prefix && x.suffix === k.suffix);
  const first = same[0];
  const last = same[same.length - 1];
  if (!first || !last || same.length < 2) return 1;
  return ((last.n - first.n) / (same.length - 1)) * same.length;
}

/**
 * Recopie la plage `src` vers `target` (qui la contient et la prolonge dans une seule direction).
 * Les formules sont translatees ; les series progressent. Renvoie faux si la cible est invalide.
 */
export function autoFill(d: Draft, si: number, src: CellRange, target: CellRange, opt: SeriesOptions = {}): boolean {
  const down = target.r2 > src.r2;
  const up = target.r1 < src.r1;
  const right = target.c2 > src.c2;
  const left = target.c1 < src.c1;
  const vertical = down || up;
  if ((vertical && (left || right)) || (!vertical && !left && !right)) return false;
  const sh = d.wb.sheets[si];
  if (!sh) return false;
  const get = (r: number, c: number): Cell | undefined => sh.cells.get(r)?.get(c);
  const forward = down || right;
  const lines = vertical ? span(src.c1, src.c2) : span(src.r1, src.r2);
  const srcIdx = vertical ? span(src.r1, src.r2) : span(src.c1, src.c2);
  const ordered = forward ? srcIdx : [...srcIdx].reverse();
  const count = vertical ? (down ? target.r2 - src.r2 : src.r1 - target.r1) : (right ? target.c2 - src.c2 : src.c1 - target.c1);
  for (const line of lines) {
    const cells = ordered.map((i) => (vertical ? get(i, line) : get(line, i)));
    extendSeries(cells, count, opt).forEach((p, i) => {
      const pos = forward ? (vertical ? src.r2 : src.c2) + 1 + i : (vertical ? src.r1 : src.c1) - 1 - i;
      const origin = ordered[p.from] ?? pos;
      let cell = p.cell;
      if (cell?.formula !== undefined) {
        cell = { ...cell, formula: translateFormula(cell.formula, vertical ? pos - origin : 0, vertical ? 0 : pos - origin), value: null };
      }
      if (cell && (cell.shared || cell.array)) {
        cell = { ...cell };
        delete cell.shared;
        delete cell.array;
      }
      if (vertical) d.set(si, pos, line, cell);
      else d.set(si, line, pos, cell);
    });
  }
  return true;
}

/** Recopier vers le bas (Ctrl+B) / la droite (Ctrl+D) / le haut / la gauche : copie de la ligne ou colonne de bord. */
export function fillDirection(d: Draft, si: number, r: CellRange, dir: 'down' | 'right' | 'up' | 'left'): void {
  if (dir === 'down' || dir === 'up') {
    if (r.r1 === r.r2) return;
    const row = dir === 'down' ? r.r1 : r.r2;
    autoFill(d, si, { ...r, r1: row, r2: row }, r, { copyOnly: true });
  } else {
    if (r.c1 === r.c2) return;
    const col = dir === 'right' ? r.c1 : r.c2;
    autoFill(d, si, { ...r, c1: col, c2: col }, r, { copyOnly: true });
  }
}

/** Serie (Accueil > Remplissage > Serie) : progression lineaire ou geometrique depuis la premiere cellule. */
export function fillSeries(d: Draft, si: number, r: CellRange, byRows: boolean, step: number, kind: 'linear' | 'growth', stop?: number): void {
  const lines = byRows ? span(r.r1, r.r2) : span(r.c1, r.c2);
  for (const line of lines) {
    const first = byRows ? d.get(si, line, r.c1) : d.get(si, r.r1, line);
    if (typeof first?.value !== 'number') continue;
    let v = first.value;
    for (const p of byRows ? span(r.c1 + 1, r.c2) : span(r.r1 + 1, r.r2)) {
      v = kind === 'linear' ? v + step : v * step;
      if (stop !== undefined && ((step >= 0 && v > stop) || (step < 0 && v < stop))) break;
      const cell: Cell = { ...first, value: clean(v) };
      if (byRows) d.set(si, line, p, cell);
      else d.set(si, p, line, cell);
    }
  }
}

function span(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/** Remplissage instantane (Ctrl+E) : deduit un motif simple a partir d'un exemple. */
export function flashFillGuess(example: { source: string; result: string }, target: string): string | undefined {
  const words = example.source.split(/\s+/);
  const targetWords = target.split(/\s+/);
  const idx = words.findIndex((w) => w === example.result);
  if (idx >= 0) return targetWords[idx];
  if (example.result === example.source.toUpperCase()) return target.toUpperCase();
  if (example.result === example.source.toLowerCase()) return target.toLowerCase();
  if (example.result === words.map((w) => w.charAt(0)).join('')) return targetWords.map((w) => w.charAt(0)).join('');
  const at = example.source.indexOf('@');
  if (at > 0 && example.result === example.source.slice(0, at)) return target.split('@')[0];
  return undefined;
}


/** Derniere ligne a remplir par un double-clic sur la poignee : tant que la colonne voisine (gauche, sinon droite) contient des donnees. */
export function autoFillEnd(sheet: Sheet, src: CellRange): number {
  const filled = (row: number, col: number): boolean => {
    const c = sheet.cells.get(row)?.get(col);
    return !!c && (c.value !== null || c.formula !== undefined);
  };
  const side = [src.c1 - 1, src.c2 + 1].find((col) => col >= 0 && filled(src.r2, col) || (col >= 0 && filled(src.r2 + 1, col)));
  if (side === undefined) return src.r2;
  let r = src.r2;
  while (filled(r + 1, side)) r++;
  return r;
}
