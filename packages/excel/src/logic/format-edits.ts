// Etat de la boite « Format de cellule » (sans DOM) : lecture de l'etat d'une selection (valeur de la cellule active,
// champs qui different d'une cellule a l'autre) et conversion des SEULES modifications faites par l'utilisateur en
// correctif de style. Un champ non touche n'est jamais reecrit : une selection hetérogene garde ses differences.
import {
  type Alignment, type Color, type CellRange, type Fill, type Font, type HorizontalAlignment, type Sheet, type UnderlineStyle, type VerticalAlignment, type Workbook,
} from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { forEachCell } from './draft.ts';
import { applyBorderSpec, readBorders, type BorderSpec } from './border-spec.ts';
import { applyPatch, cellFormat, fillOf, fontOf, mergeAt, mergeCells, NO_FILL, numFmtOf, styleAt, type StylePatch } from './styles.ts';

/** Champs d'un seul tenant (hors bordures, fusion). */
export interface FormatFields {
  numFmt: string;
  h: HorizontalAlignment;
  v: VerticalAlignment;
  wrap: boolean;
  shrink: boolean;
  indent: number;
  /** Valeur xlsx brute : 0..90 vers le haut, 91..180 vers le bas, 255 empile. */
  rotation: number;
  /** 0 contexte, 1 gauche a droite, 2 droite a gauche. */
  readingOrder: number;
  fontName: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: UnderlineStyle | null;
  strike: boolean;
  vertAlign: 'superscript' | 'subscript' | null;
  /** null = automatique. */
  color: Color | null;
  fill: Fill;
  locked: boolean;
  hidden: boolean;
}

export type FieldKey = keyof FormatFields;

export interface FormatView {
  fields: FormatFields;
  border: BorderSpec;
  merged: boolean;
  /** La plage active compte plusieurs lignes / colonnes (bords interieurs possibles). */
  multiRow: boolean;
  multiCol: boolean;
}

export interface FormatState {
  view: FormatView;
  /** Champs dont la valeur differe d'une cellule a l'autre de la selection. */
  mixed: ReadonlySet<FieldKey>;
}

/** Modifications faites dans la boite : seules les cles presentes sont appliquees. */
export type FormatEdits = Partial<FormatFields> & { border?: BorderSpec; merged?: boolean };

function fieldsOf(wb: Workbook, styleId: number): FormatFields {
  const xf = cellFormat(wb, styleId);
  const font = fontOf(wb, styleId);
  const a = xf.alignment ?? {};
  return {
    numFmt: numFmtOf(wb, styleId),
    h: a.horizontal ?? 'general',
    v: a.vertical ?? 'bottom',
    wrap: !!a.wrapText,
    shrink: !!a.shrinkToFit,
    indent: a.indent ?? 0,
    rotation: a.textRotation ?? 0,
    readingOrder: a.readingOrder ?? 0,
    fontName: font.name,
    size: font.size,
    bold: !!font.bold,
    italic: !!font.italic,
    underline: font.underline ?? null,
    strike: !!font.strike,
    vertAlign: font.vertAlign ?? null,
    color: font.color && !font.color.auto ? font.color : null,
    fill: fillOf(wb, styleId) ?? NO_FILL,
    locked: xf.protection?.locked !== false,
    hidden: !!xf.protection?.hidden,
  };
}

/** Styles de toutes les cellules de la selection (bornes : au-dela de 50 000 cellules, seules les cellules existantes). */
function stylesIn(sh: Sheet, ranges: readonly CellRange[], active: { row: number; col: number }): Set<number> {
  const out = new Set<number>([styleAt(sh, active.row, active.col)]);
  for (const r of ranges) {
    if ((r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1) <= 50_000) {
      for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) out.add(styleAt(sh, row, col));
    } else {
      out.add(0);
      forEachCell(sh, r, (_row, _col, cell) => out.add(cell.styleId ?? 0));
    }
  }
  return out;
}

/** Etat de la boite pour une selection : valeurs de la cellule active + champs differents ailleurs. */
export function readFormat(wb: Workbook, si: number, ranges: readonly CellRange[], active: { row: number; col: number }): FormatState {
  const sh = wb.sheets[si];
  const base = fieldsOf(wb, sh ? styleAt(sh, active.row, active.col) : 0);
  const mixed = new Set<FieldKey>();
  if (!sh) return { view: { fields: base, border: {}, merged: false, multiRow: false, multiCol: false }, mixed };
  for (const id of stylesIn(sh, ranges, active)) {
    const other = fieldsOf(wb, id);
    for (const k of Object.keys(base) as FieldKey[]) if (JSON.stringify(other[k]) !== JSON.stringify(base[k])) mixed.add(k);
  }
  const range = ranges[ranges.length - 1] ?? { r1: active.row, c1: active.col, r2: active.row, c2: active.col };
  const merged = !!mergeAt(sh.merges, active.row, active.col);
  return { view: { fields: base, border: readBorders(wb, sh, range), merged, multiRow: range.r2 > range.r1, multiCol: range.c2 > range.c1 }, mixed };
}

/** Rotation xlsx -> degres d'orientation (-90..90), ou null pour le texte empile. */
export function rotationToDegrees(rotation: number): number | null {
  if (rotation === 255) return null;
  return rotation <= 90 ? rotation : 90 - rotation;
}

/** Degres (-90..90) -> rotation xlsx. */
export function degreesToRotation(deg: number): number {
  const d = Math.max(-90, Math.min(90, Math.round(deg)));
  return d >= 0 ? d : 90 - d;
}

/** Correctif de style des seules modifications (la fusion et les bordures sont traitees a part par `applyEdits`). */
export function editsToPatch(e: FormatEdits): StylePatch {
  const patch: StylePatch = {};
  const font: Partial<Font> = {};
  if (e.fontName !== undefined) {
    font.name = e.fontName;
    font.scheme = undefined; // une police choisie a la main n'est plus celle du theme
  }
  if (e.size !== undefined) font.size = e.size;
  if (e.bold !== undefined) font.bold = e.bold;
  if (e.italic !== undefined) font.italic = e.italic;
  if (e.strike !== undefined) font.strike = e.strike;
  if (e.underline !== undefined) font.underline = e.underline ?? undefined;
  if (e.vertAlign !== undefined) font.vertAlign = e.vertAlign ?? undefined;
  if (e.color !== undefined) font.color = e.color ?? undefined;
  if (Object.keys(font).length) patch.font = font;
  const al: Partial<Alignment> = {};
  if (e.h !== undefined) al.horizontal = e.h;
  if (e.v !== undefined) al.vertical = e.v;
  if (e.wrap !== undefined) al.wrapText = e.wrap;
  if (e.shrink !== undefined) al.shrinkToFit = e.shrink;
  if (e.indent !== undefined) al.indent = e.indent;
  if (e.rotation !== undefined) al.textRotation = e.rotation;
  if (e.readingOrder !== undefined) al.readingOrder = e.readingOrder;
  if (Object.keys(al).length) patch.alignment = al;
  if (e.numFmt !== undefined) patch.numberFormat = e.numFmt;
  if (e.fill !== undefined) patch.fill = e.fill;
  if (e.locked !== undefined || e.hidden !== undefined) patch.protection = { ...(e.locked !== undefined ? { locked: e.locked } : {}), ...(e.hidden !== undefined ? { hidden: e.hidden } : {}) };
  return patch;
}

/** Applique les modifications a la selection ; renvoie vrai si la fusion a fait perdre des donnees. */
export function applyEdits(d: Draft, si: number, ranges: readonly CellRange[], e: FormatEdits): boolean {
  const patch = editsToPatch(e);
  if (Object.keys(patch).length) applyPatch(d, si, ranges, patch);
  if (e.border) applyBorderSpec(d, si, ranges, e.border);
  if (e.merged !== undefined) return mergeCells(d, si, ranges, e.merged ? 'merge' : 'unmerge');
  return false;
}

/** Vrai si la boite n'a rien a appliquer. */
export function isEmpty(e: FormatEdits): boolean {
  return Object.keys(e).length === 0 || (Object.keys(e).length === 1 && e.border !== undefined && Object.keys(e.border).length === 0);
}
