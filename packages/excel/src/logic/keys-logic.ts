// Logique sans DOM des raccourcis clavier : formats de nombre des Ctrl+Maj+symbole, touches chiffres AZERTY, coins de la selection,
// formule matricielle (Ctrl+Maj+Entree), liste « Choisir dans la liste deroulante » (Alt+Bas), noms depuis la selection (Ctrl+Maj+F3).
import { columnName, type Cell, type CellRange, type DefinedName, type Sheet } from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import type { Entry } from './cells.ts';
import { activeRange, cellSelection, type Selection } from './selection.ts';

/** Formats appliques par Ctrl+Maj+~ ! # @ $ % ^ (codes canoniques ; l'affichage les localise). */
export const KEY_FORMATS = {
  general: 'General',
  number: '#,##0.00',
  currency: '#,##0.00 [$€-40C]',
  percent: '0%',
  scientific: '0.00E+00',
  date: 'dd-mmm-yy',
  time: 'hh:mm',
} as const;

/** Symboles deja pris par un raccourci : une touche chiffre AZERTY qui les produit ne vaut pas « chiffre ». */
const CLAIMED = '&"\'(_)!#@$%^~*:;';

/**
 * Touche chiffre : `key` vaut le chiffre (QWERTY, ou AZERTY avec Maj) ou la touche physique `DigitN` produit un symbole
 * (AZERTY sans Maj : `ç` pour 9, `à` pour 0) qu'aucun autre raccourci ne reclame.
 */
export function isDigit(e: { key: string; code?: string }, digit: string): boolean {
  return e.key === digit || (e.code === `Digit${digit}` && e.key.length === 1 && !CLAIMED.includes(e.key) && !/[0-9]/.test(e.key));
}

/** Coins de la plage, sens horaire depuis le haut a gauche, sans doublon (plage d'une seule ligne ou colonne : deux coins). */
const corners = (r: CellRange): { row: number; col: number }[] => {
  const all = [{ row: r.r1, col: r.c1 }, { row: r.r1, col: r.c2 }, { row: r.r2, col: r.c2 }, { row: r.r2, col: r.c1 }];
  return all.filter((c, i) => all.findIndex((o) => o.row === c.row && o.col === c.col) === i);
};

/** Ctrl+Point : la cellule active passe au coin suivant (sens horaire) de la plage active ; la plage ne change pas. */
export function nextCorner(sel: Selection): Selection {
  const r = activeRange(sel);
  if (r.r1 === r.r2 && r.c1 === r.c2) return sel;
  const list = corners(r);
  const at = list.findIndex((c) => c.row === sel.active.row && c.col === sel.active.col);
  const next = list[(at + 1) % list.length] ?? list[0];
  if (!next) return sel;
  const opposite = { row: next.row === r.r1 ? r.r2 : r.r1, col: next.col === r.c1 ? r.c2 : r.c1 };
  return { ranges: sel.ranges, active: next, anchor: opposite };
}

/** Maj+Retour arriere : la selection se reduit a la cellule active. */
export const reduceToActive = (sel: Selection): Selection => cellSelection(sel.active.row, sel.active.col);

/**
 * Ctrl+Maj+Entree : la formule saisie devient une formule matricielle sur `range` (cellule maitre portant `array`, les autres
 * cellules de la plage sont videes : le moteur y repartit le resultat).
 */
export function commitArrayEntry(d: Draft, si: number, range: CellRange, entry: Entry & { ok: true }): void {
  if (entry.formula === undefined) throw new RangeError('formule matricielle sans formule');
  for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) d.set(si, r, c, undefined);
  const style = d.sheet(si).cells.get(range.r1)?.get(range.c1)?.styleId;
  const cell: Cell = { value: null, formula: entry.formula, array: { ref: { ...range } }, ...(style ? { styleId: style } : {}) };
  d.set(si, range.r1, range.c1, cell);
}

/** Lettres significatives d'un texte pour le tri (sans accents ni casse), comme la liste d'Excel. */
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Alt+Bas sur une cellule vide ou texte : valeurs textuelles distinctes du bloc de la colonne qui touche la cellule
 * (au-dessus et en dessous, jusqu'aux cellules vides), triees. Vide si aucune cellule voisine n'est remplie.
 */
export function pickListValues(sh: Sheet, row: number, col: number, display: (row: number, col: number) => string): string[] {
  const filled = (r: number): boolean => {
    const cell = sh.cells.get(r)?.get(col);
    return !!cell && (cell.value !== null || cell.formula !== undefined);
  };
  const rows: number[] = [];
  for (let r = row - 1; r >= 0 && filled(r); r--) rows.push(r);
  for (let r = row + 1; r < row + 1_000_000 && filled(r); r++) rows.push(r);
  const seen = new Map<string, string>();
  for (const r of rows) {
    const cell = sh.cells.get(r)?.get(col);
    const text = display(r, col);
    if (!text || typeof cell?.value === 'number' || typeof cell?.value === 'boolean') continue;
    if (!seen.has(fold(text))) seen.set(fold(text), text);
  }
  return [...seen.values()].sort((a, b) => fold(a).localeCompare(fold(b), 'fr'));
}

// ------------------------------------------------------------------ Noms depuis la selection

export interface NameSides {
  top: boolean;
  left: boolean;
  bottom: boolean;
  right: boolean;
}

/** Cotes proposes par defaut : la ligne du haut / la colonne de gauche quand elles ne contiennent que du texte (comme Excel). */
export function defaultNameSides(sh: Sheet, r: CellRange): NameSides {
  const text = (row: number, col: number): boolean => {
    const v = sh.cells.get(row)?.get(col)?.value;
    return typeof v === 'string' && v !== '';
  };
  let rowText = r.r2 > r.r1;
  for (let c = r.c1; c <= r.c2 && rowText; c++) rowText = text(r.r1, c);
  let colText = r.c2 > r.c1;
  for (let row = r.r1; row <= r.r2 && colText; row++) colText = text(row, r.c1);
  return { top: rowText, left: colText, bottom: false, right: false };
}

/** Nom valide d'apres une etiquette : espaces -> « _ », caracteres interdits retires, « _ » devant un debut invalide ; null si vide. */
export function nameFromLabel(label: string): string | null {
  let n = label.trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.\\]/gu, '');
  if (!n) return null;
  if (!/^[\p{L}_\\]/u.test(n)) n = `_${n}`;
  if (/^[A-Za-z]{1,3}\d+$/.test(n) || /^[RrCc]$/.test(n)) n = `_${n}`;
  return n;
}

const quoteSheet = (name: string): string => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);
const absRange = (sheet: string, r: CellRange): string => {
  const a = `$${columnName(r.c1)}$${r.r1 + 1}`;
  const b = `$${columnName(r.c2)}$${r.r2 + 1}`;
  return `${quoteSheet(sheet)}!${a === b ? a : `${a}:${b}`}`;
};

/** Noms a creer a partir des etiquettes de la plage ; `label(row, col)` renvoie le texte affiche d'une cellule. */
export function namesFromSelection(sheetName: string, r: CellRange, sides: NameSides, label: (row: number, col: number) => string): DefinedName[] {
  const data = { r1: r.r1 + (sides.top ? 1 : 0), r2: r.r2 - (sides.bottom ? 1 : 0), c1: r.c1 + (sides.left ? 1 : 0), c2: r.c2 - (sides.right ? 1 : 0) };
  if (data.r1 > data.r2 || data.c1 > data.c2) return [];
  const out: DefinedName[] = [];
  const add = (text: string, ref: CellRange): void => {
    const name = nameFromLabel(text);
    if (name) out.push({ name, formula: absRange(sheetName, ref) });
  };
  if (sides.top) for (let c = data.c1; c <= data.c2; c++) add(label(r.r1, c), { r1: data.r1, r2: data.r2, c1: c, c2: c });
  if (sides.bottom) for (let c = data.c1; c <= data.c2; c++) add(label(r.r2, c), { r1: data.r1, r2: data.r2, c1: c, c2: c });
  if (sides.left) for (let row = data.r1; row <= data.r2; row++) add(label(row, r.c1), { r1: row, r2: row, c1: data.c1, c2: data.c2 });
  if (sides.right) for (let row = data.r1; row <= data.r2; row++) add(label(row, r.c2), { r1: row, r2: row, c1: data.c1, c2: data.c2 });
  return out;
}

/** Ajoute les noms au classeur ; un nom global existant du meme nom (casse ignoree) est remplace. */
export function mergeNames(existing: readonly DefinedName[], added: readonly DefinedName[]): DefinedName[] {
  const key = (n: DefinedName): string => `${n.name.toLowerCase()}|${n.localSheet ?? ''}`;
  const keep = new Map(existing.map((n) => [key(n), n]));
  for (const n of added) keep.set(key(n), n);
  return [...keep.values()];
}

/** « Graph1 », « Graph2 »... : premier nom libre (nom d'une feuille de graphique dans Excel). */
export function nextChartSheetName(taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  let i = 1;
  while (used.has(`graph${i}`)) i++;
  return `Graph${i}`;
}
