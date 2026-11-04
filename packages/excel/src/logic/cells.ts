// Saisie des cellules en francais (formules, nombres, dates, pourcentages) et texte affiche dans l'editeur.
import {
  FormulaParseError, formatValue, fromLocalized, isDateFormat, numberToText, parseFormula, parseInput, stripEquals, toLocalized,
} from '@forgeoffice/formulas';
import type { Cell, CellRange, CellValue, Workbook } from '@forgeoffice/xlsx';
import { forEachCell, type Draft } from './draft.ts';
import { numFmtOf, patchStyleId, styleAt } from './styles.ts';

export type Entry =
  | { ok: true; value: CellValue; formula?: string; format?: string }
  | { ok: false; message: string; position: number };

/** Ajoute les parentheses fermantes manquantes (correction automatique d'Excel). */
function closeParens(formula: string): string {
  let depth = 0;
  let inStr = false;
  for (const ch of formula) {
    if (ch === '"') inStr = !inStr;
    else if (!inStr && ch === '(') depth++;
    else if (!inStr && ch === ')') depth--;
  }
  return depth > 0 && !inStr ? formula + ')'.repeat(depth) : formula;
}

/** Interprete une saisie francaise : « =SOMME(A1:A3) », « 12,5 », « 15 % », « 03/11/2026 », « VRAI ». */
export function parseEntry(text: string, date1904 = false): Entry {
  const p = parseInput(text, 'fr-FR', { dateSystem: date1904 ? 1904 : 1900 });
  switch (p.type) {
    case 'blank': return { ok: true, value: null };
    case 'boolean': return { ok: true, value: p.value };
    case 'error': return { ok: true, value: { error: p.value } };
    case 'text': return { ok: true, value: p.value };
    case 'number': return p.format === undefined ? { ok: true, value: p.value } : { ok: true, value: p.value, format: p.format };
    case 'formula': {
      const local = closeParens(p.formula.trim());
      try {
        const canonical = stripEquals(fromLocalized(local.startsWith('=') ? local : `=${local}`, 'fr'));
        parseFormula(canonical);
        return { ok: true, value: null, formula: canonical };
      } catch (e) {
        if (e instanceof FormulaParseError) return { ok: false, message: e.message, position: e.position };
        throw e;
      }
    }
  }
}

/** Ecrit une saisie dans une cellule (style conserve ; format de nombre deduit si la cellule est au format Standard). */
export function commitEntry(d: Draft, si: number, row: number, col: number, entry: Entry & { ok: true }): void {
  const sh = d.sheet(si);
  let styleId = styleAt(sh, row, col);
  if (entry.format && numFmtOf(d.wb, styleId) === 'General') styleId = patchStyleId(d.wb, styleId, { numberFormat: entry.format });
  if (entry.value === null && entry.formula === undefined && styleId === 0) {
    d.set(si, row, col, undefined);
    return;
  }
  const cell: Cell = { value: entry.value };
  if (entry.formula !== undefined) cell.formula = entry.formula;
  if (styleId) cell.styleId = styleId;
  d.set(si, row, col, cell);
}

/** Texte presente dans la barre de formule / l'editeur pour une cellule. */
export function editText(wb: Workbook, cell: Cell | undefined): string {
  if (!cell) return '';
  if (cell.formula !== undefined) return toLocalized(`=${cell.formula}`, 'fr');
  const v = cell.value;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'object') return toLocalized(`=${v.error}`, 'fr').slice(1);
  if (typeof v === 'string') return needsQuote(v) ? `'${v}` : v;
  const code = numFmtOf(wb, cell.styleId);
  if (isDateFormat(code)) {
    const hasTime = /[hs]/i.test(code.replace(/"[^"]*"/g, ''));
    const whole = Number.isInteger(v);
    const date1904 = { dateSystem: wb.date1904 ? 1904 as const : 1900 as const };
    if (v < 1 && !whole) return formatValue(v, 'hh:mm:ss', 'fr-FR', date1904);
    return formatValue(v, hasTime || !whole ? 'dd/mm/yyyy hh:mm:ss' : 'dd/mm/yyyy', 'fr-FR', date1904);
  }
  if (/%/.test(code.replace(/"[^"]*"/g, ''))) return `${numberToText(v * 100, 'fr-FR')} %`;
  return numberToText(v, 'fr-FR');
}

/** Texte qui serait interprete autrement s'il etait ressaisi (nombre, formule, booleen) : prefixe « ' ». */
function needsQuote(v: string): boolean {
  if (v === '') return false;
  const p = parseInput(v, 'fr-FR');
  return p.type !== 'text';
}

export type ClearWhat = 'all' | 'contents' | 'formats' | 'comments' | 'links';

/** Effacer (Accueil > Effacer) : tout, le contenu, les formats, les commentaires/notes ou les liens. */
export function clearRanges(d: Draft, si: number, ranges: readonly CellRange[], what: ClearWhat): void {
  const sh = d.sheet(si);
  const inside = (r: CellRange, row: number, col: number): boolean => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2;
  for (const r of ranges) {
    if (what === 'comments' || what === 'all') {
      sh.notes = sh.notes.filter((n) => !inside(r, n.ref.row, n.ref.col));
      sh.threadedComments = sh.threadedComments.filter((n) => !inside(r, n.ref.row, n.ref.col));
    }
    if (what === 'links' || what === 'all') sh.hyperlinks = sh.hyperlinks.filter((h) => !inside(r, h.ref.r1, h.ref.c1));
    if (what === 'comments' || what === 'links') continue;
    const updates: [number, number, Cell][] = [];
    forEachCell(sh, r, (row, col, cell) => updates.push([row, col, cell]));
    for (const [row, col, cell] of updates) {
      if (what === 'all') d.set(si, row, col, undefined);
      else if (what === 'contents') d.set(si, row, col, cell.styleId ? { value: null, styleId: cell.styleId } : undefined);
      else {
        const next: Cell = { ...cell };
        delete next.styleId;
        d.set(si, row, col, next.value === null && next.formula === undefined ? undefined : next);
      }
    }
  }
}

/** Ecrit la meme saisie dans toutes les cellules (Ctrl+Entree). */
export function fillRanges(d: Draft, si: number, ranges: readonly CellRange[], entry: Entry & { ok: true }, translate: (f: string, dr: number, dc: number) => string, origin: { row: number; col: number }): void {
  for (const r of ranges) {
    if ((r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1) > 1_000_000) continue;
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) {
        const e = entry.formula === undefined ? entry : { ...entry, formula: translate(entry.formula, row - origin.row, col - origin.col) };
        commitEntry(d, si, row, col, e);
      }
    }
  }
}
