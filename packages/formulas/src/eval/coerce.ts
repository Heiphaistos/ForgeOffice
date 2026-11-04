// Coercitions exactes d'Excel et lecture des references.
import { parseNumberText } from '../format/input.ts';
import { localeData } from '../format/locale.ts';
import { numberToText } from '../format/render.ts';
import type { Area } from '../refs.ts';
import { ERR, FormulaError, Matrix, type Scalar, type Value } from '../values.ts';
import { LambdaValue, RefValue, type EvalContext, type EvalValue } from './types.ts';

/** Au-dela de ce nombre de cellules, une zone est tronquee a la partie utilisee de la feuille. */
const CLIP_THRESHOLD = 1_000_000;
export const MAX_TEXT = 32767;

/** Zone effectivement lue (les colonnes/lignes entieres sont limitees a la partie utilisee). */
export function effectiveArea(area: Area, ctx: EvalContext): Area {
  const cells = (area.r2 - area.r1 + 1) * (area.c2 - area.c1 + 1);
  if (cells <= CLIP_THRESHOLD) return area;
  const b = ctx.wb.usedBounds(area.sheet);
  return {
    sheet: area.sheet,
    r1: area.r1,
    c1: area.c1,
    r2: Math.max(area.r1, Math.min(area.r2, b.rows - 1)),
    c2: Math.max(area.c1, Math.min(area.c2, b.cols - 1)),
  };
}

/** Lit une zone en matrice. */
export function readArea(area: Area, ctx: EvalContext): Matrix {
  const a = effectiveArea(area, ctx);
  const rows = a.r2 - a.r1 + 1;
  const cols = a.c2 - a.c1 + 1;
  const data = new Array<Scalar>(rows * cols).fill(null);
  if (rows * cols > 4096) {
    ctx.wb.forEachCell(a, (r, c, v) => {
      data[(r - a.r1) * cols + (c - a.c1)] = v;
    });
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) data[r * cols + c] = ctx.wb.getCell(a.sheet, a.r1 + r, a.c1 + c);
    }
  }
  return new Matrix(rows, cols, data);
}

/** Reference -> valeur (cellule seule -> scalaire, zone -> matrice). */
export function deref(v: EvalValue | undefined, ctx: EvalContext): Value {
  if (v === undefined) return null;
  if (v instanceof RefValue) {
    if (v.areas.length !== 1) return ERR.VALUE;
    const a = v.areas[0];
    if (!a) return ERR.REF;
    if (a.r1 === a.r2 && a.c1 === a.c2) return ctx.wb.getCell(a.sheet, a.r1, a.c1);
    return readArea(a, ctx);
  }
  if (v instanceof LambdaValue) return ERR.CALC;
  if (v instanceof Matrix && v.rows === 1 && v.cols === 1) return v.data[0] ?? null;
  return v;
}

/** Valeur -> scalaire (coin superieur gauche d'une matrice). */
export function toScalar(v: EvalValue | undefined, ctx: EvalContext): Scalar {
  const d = deref(v, ctx);
  return d instanceof Matrix ? d.get(0, 0) : d;
}

/** Valeur -> matrice (scalaire -> 1x1). */
export function toMatrix(v: EvalValue | undefined, ctx: EvalContext): Matrix | FormulaError {
  const d = v instanceof RefValue && v.areas.length === 1 && v.areas[0]
    ? readArea(v.areas[0], ctx)
    : deref(v, ctx);
  if (d instanceof Matrix) return d;
  if (d instanceof FormulaError && v instanceof RefValue && v.areas.length !== 1) return d;
  return new Matrix(1, 1, [d]);
}

export function textToNumber(s: string, ctx: EvalContext): number | undefined {
  return parseNumberText(s, ctx.wb.locale, { dateSystem: ctx.wb.dateSystem });
}

/** Coercition numerique d'Excel (operateurs et arguments numeriques). */
export function toNumber(v: EvalValue | undefined, ctx: EvalContext): number | FormulaError {
  const s = toScalar(v, ctx);
  if (typeof s === 'number') return s;
  if (s === null) return 0;
  if (typeof s === 'boolean') return s ? 1 : 0;
  if (s instanceof FormulaError) return s;
  const n = textToNumber(s, ctx);
  return n === undefined ? ERR.VALUE : n;
}

export function toText(v: EvalValue | undefined, ctx: EvalContext): string | FormulaError {
  const s = toScalar(v, ctx);
  return scalarToText(s, ctx);
}

export function scalarToText(s: Scalar, ctx: EvalContext): string | FormulaError {
  if (typeof s === 'string') return s;
  if (s === null) return '';
  if (typeof s === 'number') return numberToText(s, ctx.wb.locale);
  if (typeof s === 'boolean') {
    const l = localeData(ctx.wb.locale);
    return s ? l.trueName : l.falseName;
  }
  return s;
}

export function toBool(v: EvalValue | undefined, ctx: EvalContext): boolean | FormulaError {
  const s = toScalar(v, ctx);
  if (typeof s === 'boolean') return s;
  if (s === null) return false;
  if (typeof s === 'number') return s !== 0;
  if (s instanceof FormulaError) return s;
  const up = s.toUpperCase();
  const l = localeData(ctx.wb.locale);
  if (up === 'TRUE' || up === l.trueName) return true;
  if (up === 'FALSE' || up === l.falseName) return false;
  return ERR.VALUE;
}

/** Entier tronque (arguments de type nombre de caracteres, index...). */
export function toInt(v: EvalValue | undefined, ctx: EvalContext): number | FormulaError {
  const n = toNumber(v, ctx);
  return typeof n === 'number' ? Math.trunc(n) : n;
}

/**
 * Parcourt les valeurs d'un argument. `direct` vaut true pour une valeur saisie directement
 * (pas issue d'une reference ni d'une matrice). Le rappel renvoie true pour arreter.
 */
export function forEachValue(
  arg: EvalValue | undefined,
  ctx: EvalContext,
  cb: (v: Scalar, direct: boolean) => boolean | void,
): void {
  if (arg === undefined) return;
  if (arg instanceof RefValue) {
    for (const area of arg.areas) {
      let stop = false;
      const a = effectiveArea(area, ctx);
      ctx.wb.forEachCell(a, (_r, _c, v) => {
        if (cb(v, false) === true) {
          stop = true;
          return true;
        }
        return false;
      });
      if (stop) return;
    }
    return;
  }
  if (arg instanceof LambdaValue) {
    cb(ERR.CALC, true);
    return;
  }
  if (arg instanceof Matrix) {
    for (const v of arg.data) if (cb(v, false) === true) return;
    return;
  }
  cb(arg, true);
}

export interface NumberCollectOptions {
  /** Mode « A » (MOYENNEA, MAXA...) : texte des references = 0, booleens comptes. */
  aMode?: boolean;
  /** Ignorer les erreurs (AGREGAT). */
  skipErrors?: boolean;
}

/** Nombres des arguments selon les regles de SOMME/MOYENNE/MAX... ; renvoie la premiere erreur rencontree. */
export function collectNumbers(
  args: readonly (EvalValue | undefined)[],
  ctx: EvalContext,
  opt: NumberCollectOptions = {},
): number[] | FormulaError {
  const out: number[] = [];
  let error: FormulaError | undefined;
  for (const arg of args) {
    forEachValue(arg, ctx, (v, direct) => {
      if (typeof v === 'number') out.push(v);
      else if (v instanceof FormulaError) {
        if (!opt.skipErrors) {
          error = v;
          return true;
        }
      } else if (typeof v === 'boolean') {
        if (direct || opt.aMode) out.push(v ? 1 : 0);
      } else if (typeof v === 'string') {
        if (direct) {
          const n = textToNumber(v, ctx);
          if (n === undefined) {
            error = ERR.VALUE;
            return true;
          }
          out.push(n);
        } else if (opt.aMode) out.push(0);
      } else if (v === null && direct && arg !== undefined && !(arg instanceof RefValue)) {
        out.push(0);
      }
      return false;
    });
    if (error) return error;
  }
  return out;
}

const collator = new Intl.Collator('fr', { sensitivity: 'accent' });

export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  const r = collator.compare(a, b);
  return r < 0 ? -1 : r > 0 ? 1 : 0;
}

/** Egalite numerique d'Excel (15 chiffres significatifs). */
export function numEquals(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-15;
}

function typeRank(v: Scalar): number {
  return typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
}

/** Comparaison d'Excel entre deux scalaires non erreur : nombres < textes < booleens, vide = valeur vide du type. */
export function compareScalars(a: Scalar, b: Scalar): number {
  let x = a;
  let y = b;
  if (x === null && y === null) return 0;
  if (x === null) x = typeof y === 'number' ? 0 : typeof y === 'string' ? '' : false;
  if (y === null) y = typeof x === 'number' ? 0 : typeof x === 'string' ? '' : false;
  const ra = typeRank(x);
  const rb = typeRank(y);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (typeof x === 'number' && typeof y === 'number') return numEquals(x, y) ? 0 : x < y ? -1 : 1;
  if (typeof x === 'string' && typeof y === 'string') return compareText(x, y);
  if (typeof x === 'boolean' && typeof y === 'boolean') return x === y ? 0 : x ? 1 : -1;
  return 0;
}

/** Nombre fini ou #NOMBRE! */
export function checkNum(n: number): number | FormulaError {
  return Number.isFinite(n) ? n : ERR.NUM;
}
