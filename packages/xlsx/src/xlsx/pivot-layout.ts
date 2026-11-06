// Disposition d'un tableau croise (rowItems / colItems / location) calculee depuis le cache et les champs.
// Reproduit ce qu'ecrit Excel : disposition compactee ou plan (sous-totaux en tete de groupe), tabulaire
// (sous-totaux en pied de groupe), champ Valeurs (-2) parmi les niveaux, totaux generaux.
import {
  comparePivotValues, pivotValueKey,
  type PivotCache, type PivotItemDef, type PivotLineItem, type PivotTable, type PivotValue,
} from '../model-pivot.ts';

/** Colonne des enregistrements de chaque champ (les champs calcules n'en ont pas : -1). */
export function recordColumns(cache: PivotCache): number[] {
  let next = 0;
  return cache.fields.map((f) => (f.formula !== undefined ? -1 : next++));
}

/** Valeurs distinctes d'un champ dans l'ordre d'apparition, completees par les elements explicites des tableaux. */
export function sharedValues(cache: PivotCache, tables: readonly PivotTable[], field: number): PivotValue[] {
  const col = recordColumns(cache)[field] ?? -1;
  const seen = new Set<string>();
  const out: PivotValue[] = [];
  const add = (v: PivotValue): void => {
    const k = pivotValueKey(v);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };
  if (col >= 0) for (const row of cache.records) add(row[col] ?? null);
  for (const t of tables) for (const item of t.fields[field]?.items ?? []) add(item.value);
  return out;
}

/** Elements d'un champ dans l'ordre d'affichage (explicite, sinon tri croissant) ; les valeurs inconnues sont ajoutees. */
export function orderedItems(cache: PivotCache, table: PivotTable, field: number): PivotItemDef[] {
  const explicit = table.fields[field]?.items;
  const all = sharedValues(cache, [table], field);
  if (!explicit) return all.sort(comparePivotValues).map((value) => ({ value }));
  const seen = new Set(explicit.map((i) => pivotValueKey(i.value)));
  return [...explicit, ...all.filter((v) => !seen.has(pivotValueKey(v))).sort(comparePivotValues).map((value) => ({ value }))];
}

interface Node {
  /** Position de l'element (ou index du champ de donnees). */
  pos: number;
  data: boolean;
  children: Node[];
}

type Level = { field: number; positions: Map<string, number> } | { data: true };

function buildTree(levels: Level[], tuples: number[][], dataCount: number, depth = 0, offset = 0): Node[] {
  const level = levels[depth];
  if (!level) return [];
  if ('data' in level) {
    return Array.from({ length: dataCount }, (_, d) => ({ pos: d, data: true, children: buildTree(levels, tuples, dataCount, depth + 1, offset) }));
  }
  const groups = new Map<number, number[][]>();
  for (const t of tuples) {
    const p = t[offset] ?? 0;
    const list = groups.get(p);
    if (list) list.push(t);
    else groups.set(p, [t]);
  }
  return [...groups.keys()].sort((a, b) => a - b).map((pos) => ({
    pos,
    data: false,
    children: buildTree(levels, groups.get(pos) ?? [], dataCount, depth + 1, offset + 1),
  }));
}

function emitTop(nodes: Node[], level: number, out: PivotLineItem[]): void {
  for (const n of nodes) {
    const item: PivotLineItem = { x: [n.pos] };
    if (level > 0) item.repeat = level;
    if (n.data) item.dataIndex = n.pos;
    out.push(item);
    emitTop(n.children, level + 1, out);
  }
}

interface BottomState {
  prev: number[];
  out: PivotLineItem[];
  /** Sous-totaux automatiques par niveau. */
  subtotal: boolean[];
  depth: number;
  dataCount: number;
  lastIsData: boolean;
}

function commonPrefix(a: number[], b: number[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function emitBottom(nodes: Node[], level: number, path: number[], s: BottomState): void {
  for (const n of nodes) {
    const here = [...path, n.pos];
    if (level === s.depth - 1) {
      const r = Math.min(commonPrefix(here, s.prev), s.depth - 1);
      const item: PivotLineItem = { x: here.slice(r) };
      if (r > 0) item.repeat = r;
      if (n.data) item.dataIndex = n.pos;
      s.out.push(item);
      s.prev = here;
      continue;
    }
    emitBottom(n.children, level + 1, here, s);
    if (s.subtotal[level] && !n.data) {
      const copies = s.lastIsData ? s.dataCount : 1;
      for (let d = 0; d < copies; d++) {
        const item: PivotLineItem = { type: 'default', x: [n.pos] };
        if (level > 0) item.repeat = level;
        if (d > 0) item.dataIndex = d;
        s.out.push(item);
      }
    }
  }
}

export interface AxisLayout {
  items: PivotLineItem[];
  /** Nombre de niveaux reels (hors champ Valeurs). */
  realLevels: number;
}

export interface PivotLayout {
  rowItems: PivotLineItem[];
  colItems: PivotLineItem[];
  firstHeaderRow: number;
  firstDataRow: number;
  firstDataCol: number;
}

function visibleRecords(cache: PivotCache, table: PivotTable, order: Map<number, Map<string, number>>): PivotValue[][] {
  const cols = recordColumns(cache);
  const hidden = new Map<number, Set<string>>();
  for (const [f, def] of table.fields.entries()) {
    const set = new Set((def.items ?? []).filter((i) => i.hidden).map((i) => pivotValueKey(i.value)));
    if (set.size) hidden.set(f, set);
  }
  return cache.records.filter((row) => {
    for (const [f, set] of hidden) if (set.has(pivotValueKey(row[cols[f] ?? -1] ?? null))) return false;
    for (const p of table.pageFields) {
      if (p.selected === undefined) continue;
      if (pivotValueKey(row[cols[p.field] ?? -1] ?? null) !== pivotValueKey(p.selected)) return false;
    }
    void order;
    return true;
  });
}

function axis(
  cache: PivotCache,
  table: PivotTable,
  fields: number[],
  records: PivotValue[][],
  positions: Map<number, Map<string, number>>,
  mode: 'top' | 'bottom',
  grand: boolean,
): PivotLineItem[] {
  const cols = recordColumns(cache);
  const dataCount = Math.max(1, table.dataFields.length);
  const levels: Level[] = fields.map((f) => (f === -2 ? { data: true } : { field: f, positions: positions.get(f) ?? new Map() }));
  const real = fields.filter((f) => f !== -2);
  const tuples = records.map((row) => real.map((f) => positions.get(f)?.get(pivotValueKey(row[cols[f] ?? -1] ?? null)) ?? 0));
  const unique = new Map<string, number[]>();
  for (const t of tuples) unique.set(t.join(','), t);
  const tree = buildTree(levels, real.length ? [...unique.values()] : [[]], dataCount);
  const out: PivotLineItem[] = [];
  const lastIsData = fields[fields.length - 1] === -2;
  if (fields.length === 0) out.push({ x: [] });
  else if (mode === 'top') emitTop(tree, 0, out);
  else {
    const subtotal = fields.map((f, i) => i < fields.length - 1 && fields[i + 1] !== -2 && f !== -2 && table.fields[f]?.defaultSubtotal !== false);
    emitBottom(tree, 0, [], { prev: [], out, subtotal, depth: fields.length, dataCount, lastIsData });
  }
  if (grand && fields.some((f) => f !== -2)) {
    const copies = lastIsData ? dataCount : 1;
    for (let d = 0; d < copies; d++) out.push(d === 0 ? { type: 'grand', x: [0] } : { type: 'grand', dataIndex: d, x: [0] });
  }
  return out;
}

/** Disposition complete du tableau (a partir du cache, des filtres et des champs). */
export function layoutPivot(cache: PivotCache, table: PivotTable, layout: 'compact' | 'outline' | 'tabular'): PivotLayout {
  const positions = new Map<number, Map<string, number>>();
  for (const f of new Set([...table.rowFields, ...table.colFields].filter((n) => n >= 0))) {
    positions.set(f, new Map(orderedItems(cache, table, f).map((it, i) => [pivotValueKey(it.value), i])));
  }
  const records = visibleRecords(cache, table, positions);
  const mode = layout === 'tabular' ? 'bottom' : 'top';
  const rowItems = axis(cache, table, table.rowFields, records, positions, mode, table.rowGrandTotals !== false);
  const colItems = axis(cache, table, table.colFields, records, positions, 'bottom', table.colGrandTotals !== false);
  const realCols = table.colFields.filter((f) => f !== -2).length;
  const multiData = table.dataFields.length > 1;
  const hasValuesOnCols = table.colFields.includes(-2);
  const firstHeaderRow = realCols > 0 ? 1 : multiData && hasValuesOnCols ? 0 : 1;
  const firstDataRow = realCols > 0 ? realCols + 1 + (hasValuesOnCols && multiData ? 1 : 0) : 1;
  const firstDataCol = layout === 'compact' ? 1 : Math.max(1, table.rowFields.filter((f) => f !== -2).length);
  return { rowItems, colItems, firstHeaderRow, firstDataRow, firstDataCol };
}
