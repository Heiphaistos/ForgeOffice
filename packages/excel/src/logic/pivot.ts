// Tableaux croises dynamiques : champs de lignes (imbriques), de colonnes, valeurs (somme, nombre, moyenne,
// max, min, produit, ecart type, variance) affichees en valeur ou en pourcentage, filtres de rapport.
// Disposition compactee d'Excel (sous-totaux en tete de groupe, « Total general »).
import { FormulaError, type Scalar } from '@forgeoffice/formulas';
import type { CellRange, CellValue } from '@forgeoffice/xlsx';
import { compareValues } from './data.ts';
import type { Draft } from './draft.ts';
import { patchStyleId, solidFill } from './styles.ts';
import { fromScalar } from './engine.ts';

export type PivotFn = 'sum' | 'count' | 'average' | 'max' | 'min' | 'product' | 'countNums' | 'stdDev' | 'var';
export type PivotShow = 'normal' | 'percentOfTotal' | 'percentOfRow' | 'percentOfCol';

export interface PivotValue {
  field: number;
  fn: PivotFn;
  show?: PivotShow;
}

export interface PivotFilter {
  field: number;
  /** Elements exclus (libelles). */
  hidden: readonly string[];
}

export interface PivotDef {
  sourceSheet: string;
  /** Plage source, en-tetes compris. */
  source: CellRange;
  rows: readonly number[];
  cols: readonly number[];
  values: readonly PivotValue[];
  filters: readonly PivotFilter[];
  /** Tri des etiquettes : croissant (defaut) ou decroissant. */
  descending?: boolean;
  grandTotalRows?: boolean;
  grandTotalCols?: boolean;
  subtotals?: boolean;
}

export type PivotCellKind = 'corner' | 'header' | 'colLabel' | 'rowLabel' | 'rowGroup' | 'value' | 'groupValue' | 'grandLabel' | 'grand' | 'filterLabel' | 'filterValue';

export interface PivotCell {
  value: Scalar;
  kind: PivotCellKind;
  indent?: number;
  /** Format de nombre suggere. */
  format?: string;
  /** Position dans le croisement (chemin de ligne, cle de colonne) : sert a retrouver les lignes sources (« Afficher les details »). */
  at?: { path: string; col: string };
}

export interface PivotResult {
  cells: PivotCell[][];
  /** Noms des champs (en-tetes de la source). */
  fields: string[];
  /** Lignes sources (en-tete compris) qui composent une cellule de valeur. */
  detail: (at: { path: string; col: string }) => Scalar[][];
}

interface Acc {
  sum: number;
  count: number;
  nums: number;
  min: number;
  max: number;
  product: number;
  sumsq: number;
}

const newAcc = (): Acc => ({ sum: 0, count: 0, nums: 0, min: Infinity, max: -Infinity, product: 1, sumsq: 0 });

function add(acc: Acc, v: Scalar): void {
  if (v === null || v === '') return;
  acc.count++;
  if (typeof v !== 'number') return;
  acc.nums++;
  acc.sum += v;
  acc.sumsq += v * v;
  acc.product *= v;
  if (v < acc.min) acc.min = v;
  if (v > acc.max) acc.max = v;
}

function result(acc: Acc | undefined, fn: PivotFn): Scalar {
  if (!acc) return null;
  switch (fn) {
    case 'sum': return acc.nums ? acc.sum : acc.count ? 0 : null;
    case 'count': return acc.count || null;
    case 'countNums': return acc.nums || null;
    case 'average': return acc.nums ? acc.sum / acc.nums : null;
    case 'max': return acc.nums ? acc.max : null;
    case 'min': return acc.nums ? acc.min : null;
    case 'product': return acc.nums ? acc.product : null;
    case 'var':
    case 'stdDev': {
      if (acc.nums < 2) return null;
      const v = (acc.sumsq - (acc.sum * acc.sum) / acc.nums) / (acc.nums - 1);
      return fn === 'var' ? v : Math.sqrt(Math.max(0, v));
    }
  }
}

/** Libelle d'un element (vide -> « (vide) »). */
export type LabelOf = (v: Scalar) => string;

const SEP = '\u0001';

export interface PivotLabels {
  rowLabels: string;
  colLabels: string;
  grandTotal: string;
  blank: string;
  all: string;
  values: string;
  /** « Somme de Ventes ». */
  valueName: (fn: PivotFn, field: string) => string;
}

/** Calcule le tableau croise a partir des donnees source (premiere ligne = en-tetes). */
export function computePivot(def: PivotDef, data: readonly (readonly Scalar[])[], label: LabelOf, L: PivotLabels): PivotResult {
  const header = data[0] ?? [];
  const fields = header.map((h, i) => (h === null || h === '' ? `${L.values} ${i + 1}` : String(h)));
  const body = data.slice(1).filter((row) => row.some((v) => v !== null && v !== ''));
  const lbl = (v: Scalar): string => (v === null || v === '' ? L.blank : label(v));
  const visible = body.filter((row) => def.filters.every((f) => !f.hidden.includes(lbl(row[f.field] ?? null))));
  const sortKeys = (items: Map<string, Scalar>): string[] => {
    const list = [...items.entries()].sort((a, b) => compareValues(a[1], b[1]) || a[0].localeCompare(b[0]));
    if (def.descending) list.reverse();
    return list.map(([k]) => k);
  };

  // Combinaisons de colonnes (tuple de libelles).
  const colItems = new Map<string, Scalar>();
  for (const row of visible) {
    const key = def.cols.map((f) => lbl(row[f] ?? null)).join(SEP);
    if (!colItems.has(key)) colItems.set(key, row[def.cols[0] ?? 0] ?? null);
  }
  const colKeys = def.cols.length ? sortKeys(colItems) : [''];

  // Accumulateurs : chemin de ligne (prefixes) x colonne x valeur.
  const accs = new Map<string, Acc>();
  const acc = (rowPath: string, col: string, vi: number): Acc => {
    const k = `${rowPath}${SEP}${SEP}${col}${SEP}${SEP}${vi}`;
    let a = accs.get(k);
    if (!a) {
      a = newAcc();
      accs.set(k, a);
    }
    return a;
  };
  interface Node { key: string; value: Scalar; children: Map<string, Node> }
  const root: Node = { key: '', value: null, children: new Map() };
  for (const row of visible) {
    const col = def.cols.map((f) => lbl(row[f] ?? null)).join(SEP);
    let node = root;
    const paths: string[] = [''];
    for (const f of def.rows) {
      const v = row[f] ?? null;
      const k = lbl(v);
      let child = node.children.get(k);
      if (!child) {
        child = { key: k, value: v, children: new Map() };
        node.children.set(k, child);
      }
      node = child;
      paths.push(`${paths[paths.length - 1]}/${k}`);
    }
    def.values.forEach((pv, vi) => {
      const v = row[pv.field] ?? null;
      for (const p of paths) {
        add(acc(p, col, vi), v);
        add(acc(p, '*', vi), v);
      }
    });
  }

  const nv = def.values.length;
  const multiValues = nv > 1;
  const grandCols = def.grandTotalCols !== false && def.cols.length > 0;
  const grandRows = def.grandTotalRows !== false;
  const subtotals = def.subtotals !== false;
  const columns: { col: string; vi: number }[] = [];
  for (const c of colKeys) for (let vi = 0; vi < Math.max(1, nv); vi++) columns.push({ col: c, vi });
  if (grandCols) for (let vi = 0; vi < Math.max(1, nv); vi++) columns.push({ col: '*', vi });

  const valueName = (vi: number): string => {
    const pv = def.values[vi];
    return pv ? L.valueName(pv.fn, fields[pv.field] ?? '') : L.values;
  };
  const cell = (rowPath: string, c: { col: string; vi: number }): PivotCell => {
    const pv = def.values[c.vi];
    const at = { path: rowPath, col: c.col };
    if (!pv) return { value: null, kind: 'value', at };
    let v = result(accs.get(`${rowPath}${SEP}${SEP}${c.col}${SEP}${SEP}${c.vi}`), pv.fn);
    const show = pv.show ?? 'normal';
    if (show !== 'normal' && typeof v === 'number') {
      const denom = show === 'percentOfTotal' ? result(accs.get(`${SEP}${SEP}*${SEP}${SEP}${c.vi}`), pv.fn)
        : show === 'percentOfRow' ? result(accs.get(`${rowPath}${SEP}${SEP}*${SEP}${SEP}${c.vi}`), pv.fn)
        : result(accs.get(`${SEP}${SEP}${c.col}${SEP}${SEP}${c.vi}`), pv.fn);
      v = typeof denom === 'number' && denom !== 0 ? v / denom : new FormulaError('#DIV/0!');
      return { value: v, kind: 'value', format: '0.00%', at };
    }
    return { value: v, kind: 'value', at };
  };

  const out: PivotCell[][] = [];
  for (const f of def.filters) {
    const hidden = f.hidden.length;
    out.push([{ value: fields[f.field] ?? '', kind: 'filterLabel' }, { value: hidden ? `(${hidden})` : L.all, kind: 'filterValue' }]);
  }
  if (def.filters.length) out.push([]);

  if (def.cols.length) {
    out.push([
      { value: nv === 1 ? valueName(0) : '', kind: 'corner' },
      { value: L.colLabels, kind: 'header' },
      ...columns.slice(1).map((): PivotCell => ({ value: null, kind: 'header' })),
    ]);
    out.push([
      { value: def.rows.length ? L.rowLabels : '', kind: 'header' },
      ...columns.map((c): PivotCell => ({
        value: c.col === '*' ? (multiValues ? `${valueName(c.vi)} (${L.grandTotal})` : L.grandTotal) : (multiValues ? `${c.col.split(SEP).join(' - ')} - ${valueName(c.vi)}` : c.col.split(SEP).join(' - ')),
        kind: 'colLabel',
      })),
    ]);
  } else {
    out.push([
      { value: def.rows.length ? L.rowLabels : '', kind: 'header' },
      ...columns.map((c): PivotCell => ({ value: valueName(c.vi), kind: 'colLabel' })),
    ]);
  }

  const walk = (node: Node, path: string, depth: number): void => {
    const keys = sortKeys(new Map([...node.children.values()].map((n) => [n.key, n.value])));
    for (const k of keys) {
      const child = node.children.get(k);
      if (!child) continue;
      const p = `${path}/${k}`;
      const isLeaf = child.children.size === 0;
      out.push([
        { value: child.key, kind: isLeaf ? 'rowLabel' : 'rowGroup', indent: depth },
        ...columns.map((c) => {
          const x = cell(p, c);
          return isLeaf || subtotals ? { ...x, kind: isLeaf ? x.kind : 'groupValue' as const } : { value: null, kind: 'groupValue' as const };
        }),
      ]);
      if (!isLeaf) walk(child, p, depth + 1);
    }
  };
  if (def.rows.length) walk(root, '', 0);
  if (grandRows || !def.rows.length) {
    out.push([
      { value: def.rows.length ? L.grandTotal : '', kind: def.rows.length ? 'grandLabel' : 'rowLabel' },
      ...columns.map((c): PivotCell => ({ ...cell('', c), kind: 'grand' })),
    ]);
  }
  const detail = (at: { path: string; col: string }): Scalar[][] => [
    [...header],
    ...visible.filter((row) => {
      const rowPath = def.rows.reduce((p, f) => `${p}/${lbl(row[f] ?? null)}`, '');
      const col = def.cols.map((f) => lbl(row[f] ?? null)).join(SEP);
      return (at.col === '*' || col === at.col) && (rowPath === at.path || rowPath.startsWith(`${at.path}/`) || at.path === '');
    }).map((row) => [...row]),
  ];
  return { cells: out, fields, detail };
}

/**
 * Ecrit le tableau croise a partir de `anchor` (style « Clair 16 » : en-tetes bleu clair, totaux en gras)
 * apres avoir efface la zone precedente. Renvoie la zone occupee.
 */
export function writePivot(d: Draft, si: number, anchor: { row: number; col: number }, res: PivotResult, previous: CellRange | null): CellRange {
  if (previous) for (let r = previous.r1; r <= previous.r2; r++) for (let c = previous.c1; c <= previous.c2; c++) d.set(si, r, c, undefined);
  const styles = new Map<string, number>();
  const style = (kind: PivotCellKind, indent: number, format: string | undefined): number => {
    const key = `${kind}|${indent}|${format ?? ''}`;
    let id = styles.get(key);
    if (id !== undefined) return id;
    const head = kind === 'header' || kind === 'colLabel' || kind === 'corner';
    const bold = head || kind === 'rowGroup' || kind === 'groupValue' || kind === 'grandLabel' || kind === 'grand' || kind === 'filterLabel';
    id = patchStyleId(d.wb, 0, {
      font: bold ? { bold: true } : {},
      ...(head || kind === 'grandLabel' || kind === 'grand' ? { fill: solidFill('DDEBF7') } : {}),
      ...(kind === 'grand' || kind === 'grandLabel' ? { border: { top: { style: 'thin', color: { rgb: 'FF9BC2E6' } } } } : head ? { border: { bottom: { style: 'thin', color: { rgb: 'FF9BC2E6' } } } } : {}),
      ...(indent ? { alignment: { indent, horizontal: 'left' } } : {}),
      ...(format ? { numberFormat: format } : {}),
    });
    styles.set(key, id);
    return id;
  };
  let maxCol = anchor.col;
  res.cells.forEach((line, r) => {
    line.forEach((cell, c) => {
      const value: CellValue = fromScalar(cell.value);
      const sid = style(cell.kind, cell.indent ?? 0, cell.format);
      d.set(si, anchor.row + r, anchor.col + c, value === null && !sid ? undefined : { value, ...(sid ? { styleId: sid } : {}) });
      maxCol = Math.max(maxCol, anchor.col + c);
    });
  });
  return { r1: anchor.row, c1: anchor.col, r2: anchor.row + Math.max(0, res.cells.length - 1), c2: maxCol };
}
