// Tableaux croises en formules : PIVOTBY (PIVOTER.PAR), LIREDONNEESTABCROISDYNAMIQUE (GETPIVOTDATA) et ROGNERPLAGE (TRIMRANGE).
import { deref, effectiveArea, toNumber, toMatrix, toText } from '../eval/coerce.ts';
import { LambdaValue, RefValue, type EvalContext } from '../eval/types.ts';
import type { Area } from '../refs.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { sortCompare } from './arrays.ts';
import { arrayArg } from './lookup.ts';
import { define, type Arg } from './registry.ts';

const L = 'lookup' as const;

const keyOf = (vals: readonly Scalar[]): string => vals.map((v) => (v instanceof FormulaError ? v.code : `${typeof v}:${String(v)}`)).join('\u0001');

function optNum(a: Arg, def: number, ctx: EvalContext): number | FormulaError {
  return a === undefined || a === null ? def : toNumber(a, ctx);
}

interface Group {
  key: Scalar[];
  rows: number[];
}

/** Regroupe les lignes de `keys` (filtrees par `keep`) par cle, triees selon `order` (>0 croissant, <0 decroissant, 0 apparition). */
function groupRows(keys: Matrix, keep: boolean[] | undefined, order: number): Group[] {
  const groups = new Map<string, Group>();
  for (let i = 0; i < keys.rows; i++) {
    if (keep && !keep[i]) continue;
    const key = keys.rowAt(i);
    const id = keyOf(key);
    const g = groups.get(id);
    if (g) g.rows.push(i);
    else groups.set(id, { key, rows: [i] });
  }
  const list = [...groups.values()];
  if (order !== 0) {
    const dir = order < 0 ? -1 : 1;
    list.sort((x, y) => {
      for (let c = 0; c < x.key.length; c++) {
        const r = sortCompare(x.key[c] ?? null, y.key[c] ?? null);
        if (r !== 0) return r * dir;
      }
      return 0;
    });
  }
  return list;
}

// PIVOTBY(lignes; colonnes; valeurs; fonction; [en-tetes]; [total lignes]; [tri lignes]; [total colonnes]; [tri colonnes]; [filtre])
// Simplification : une seule colonne de valeurs, en-tetes de champs affiches dans le coin, pas de relative_to.
define(L, 'PIVOTBY', { min: 4, max: 11, kinds: 'RRRRSSSSSV' }, (args, ctx, ev) => {
  const [rf, cf, vals, fn, hdr, rDepth, rOrder, cDepth, cOrder, filt] = args;
  const rows = arrayArg(rf, ctx);
  const cols = arrayArg(cf, ctx);
  const values = arrayArg(vals, ctx);
  if (rows instanceof FormulaError) return rows;
  if (cols instanceof FormulaError) return cols;
  if (values instanceof FormulaError) return values;
  if (!(fn instanceof LambdaValue)) return fn instanceof FormulaError ? fn : ERR.VALUE;
  if (rows.rows !== values.rows || cols.rows !== values.rows) return ERR.VALUE;
  const headerMode = optNum(hdr, -1, ctx);
  const rowDepth = optNum(rDepth, 1, ctx);
  const rowOrder = optNum(rOrder, 1, ctx);
  const colDepth = optNum(cDepth, 1, ctx);
  const colOrder = optNum(cOrder, 1, ctx);
  if (headerMode instanceof FormulaError) return headerMode;
  if (rowDepth instanceof FormulaError) return rowDepth;
  if (rowOrder instanceof FormulaError) return rowOrder;
  if (colDepth instanceof FormulaError) return colDepth;
  if (colOrder instanceof FormulaError) return colOrder;
  let start = 0;
  let corner: Scalar = null;
  let colName: Scalar = null;
  const firstNumeric = values.data.slice(0, values.cols).every((v) => typeof v === 'number');
  if (headerMode === 1 || headerMode === 3 || (headerMode === -1 && !firstNumeric)) {
    start = 1;
    corner = rows.get(0, 0);
    colName = cols.get(0, 0);
  }
  const slice = (m: Matrix): Matrix => (start === 0 ? m : new Matrix(m.rows - 1, m.cols, m.data.slice(m.cols)));
  const r = slice(rows);
  const c = slice(cols);
  const v = slice(values);
  let keep: boolean[] | undefined;
  if (filt !== undefined && filt !== null) {
    const f = toMatrix(filt, ctx);
    if (f instanceof FormulaError) return f;
    keep = f.data.map((x) => x === true || (typeof x === 'number' && x !== 0));
    if (keep.length !== v.rows) return ERR.VALUE;
  }
  const rowGroups = groupRows(r, keep, rowOrder);
  const colGroups = groupRows(c, keep, colOrder);
  const aggregate = (idx: number[]): Scalar => {
    if (idx.length === 0) return null;
    const col = Matrix.column(idx.map((i) => v.get(i, 0)));
    const out = deref(ev.callLambda(fn, [col], ctx), ctx);
    return out instanceof Matrix ? out.get(0, 0) : out;
  };
  const colIndex = colGroups.map((g) => new Set(g.rows));
  const cell = (rowsIdx: number[], ci: number): Scalar => aggregate(rowsIdx.filter((i) => colIndex[ci]?.has(i)));
  const all = [...new Set(rowGroups.flatMap((g) => g.rows))];
  const totalLabel = 'Total';
  const body: Scalar[][] = [];
  const header: Scalar[] = [corner];
  const colTotalFirst = colDepth < 0;
  if (colDepth !== 0 && colTotalFirst) header.push(totalLabel);
  header.push(...colGroups.map((g) => g.key.join(' ')));
  if (colDepth > 0) header.push(totalLabel);
  void colName;
  const line = (label: Scalar, idx: number[]): Scalar[] => {
    const cells = colGroups.map((_, ci) => cell(idx, ci));
    const total = aggregate(idx);
    const out: Scalar[] = [label];
    if (colDepth < 0) out.push(total);
    out.push(...cells);
    if (colDepth > 0) out.push(total);
    return out;
  };
  const lines = rowGroups.map((g) => line(g.key.join(' '), g.rows));
  if (rowDepth < 0) body.push(line(totalLabel, all));
  body.push(...lines);
  if (rowDepth > 0) body.push(line(totalLabel, all));
  const out = [header, ...body];
  return out.length === 1 && body.length === 0 ? ERR.CALC : Matrix.from2D(out);
});

// LIREDONNEESTABCROISDYNAMIQUE : le tableau croise est fourni par l'application hote (HostInfo.pivotValue).
define(L, 'GETPIVOTDATA', { min: 2, max: 255, kinds: 'SR' }, (args, ctx) => {
  const [field, table, ...rest] = args;
  const f = toText(field, ctx);
  if (f instanceof FormulaError) return f;
  if (!(table instanceof RefValue) || table.areas.length !== 1 || rest.length % 2 !== 0) return ERR.REF;
  const area = table.areas[0];
  const lookup = ctx.wb.host?.pivotValue;
  if (!area || !lookup) return ERR.REF;
  const pairs: [string, Scalar][] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const name = toText(rest[i], ctx);
    if (name instanceof FormulaError) return name;
    const item = deref(rest[i + 1], ctx);
    pairs.push([name, item instanceof Matrix ? item.get(0, 0) : (item as Scalar)]);
  }
  const v = lookup(ctx.wb.sheetName(area.sheet) ?? '', area.r1, area.c1, f, pairs);
  return v === undefined ? ERR.REF : v;
});

// ROGNERPLAGE(plage; [lignes]; [colonnes]) : retire les lignes/colonnes vides en tete (1), en queue (2) ou des deux cotes (3, defaut).
define(L, 'TRIMRANGE', { min: 1, max: 3, kinds: 'RSS' }, ([r, tr, tc], ctx) => {
  const rowMode = optNum(tr, 3, ctx);
  const colMode = optNum(tc, 3, ctx);
  if (rowMode instanceof FormulaError) return rowMode;
  if (colMode instanceof FormulaError) return colMode;
  if (![rowMode, colMode].every((n) => Number.isInteger(n) && n >= 0 && n <= 3)) return ERR.VALUE;
  const raw: Area | undefined = r instanceof RefValue && r.areas.length === 1 ? r.areas[0] : undefined;
  const area = raw && effectiveArea(raw, ctx);
  const m = area ? ctx.wb.readArea?.(area) ?? toMatrix(r, ctx) : toMatrix(r, ctx);
  if (m instanceof FormulaError) return m;
  const blankRow = (i: number): boolean => Array.from({ length: m.cols }, (_, j) => m.get(i, j)).every((x) => x === null);
  const blankCol = (j: number): boolean => Array.from({ length: m.rows }, (_, i) => m.get(i, j)).every((x) => x === null);
  let [r1, r2, c1, c2] = [0, m.rows - 1, 0, m.cols - 1];
  if (rowMode & 1) while (r1 <= r2 && blankRow(r1)) r1++;
  if (rowMode & 2) while (r2 >= r1 && blankRow(r2)) r2--;
  if (colMode & 1) while (c1 <= c2 && blankCol(c1)) c1++;
  if (colMode & 2) while (c2 >= c1 && blankCol(c2)) c2--;
  if (r1 > r2 || c1 > c2) return ERR.CALC;
  if (area) return new RefValue([{ sheet: area.sheet, r1: area.r1 + r1, r2: area.r1 + r2, c1: area.c1 + c1, c2: area.c1 + c2 }]);
  const data: Scalar[] = [];
  for (let i = r1; i <= r2; i++) for (let j = c1; j <= c2; j++) data.push(m.get(i, j));
  return new Matrix(r2 - r1 + 1, c2 - c1 + 1, data);
});
