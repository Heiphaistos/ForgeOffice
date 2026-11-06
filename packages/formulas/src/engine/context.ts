// Contexte d'evaluation expose aux fonctions de formules : lecture des cellules, noms, tableaux, debordement,
// avec enregistrement des dependances. Le moteur (workbook.ts) fournit l'etat par `ContextHost`.
import type { NameDefinition, TableDefinition, WorkbookContext } from '../eval/types.ts';
import { jsDateToSerial, type DateSystem } from '../format/dates.ts';
import type { NumberLocale } from '../format/locale.ts';
import { MAX_COLS, cellKey, type Area } from '../refs.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { areaStats } from './aggregate.ts';
import { posKey, type Recorder } from './deps.ts';
import type { EngineOptions, FCell, NameEntry, Sheet } from './types.ts';

export interface ContextHost {
  readonly dateSystem: DateSystem;
  readonly locale: NumberLocale;
  readonly options: EngineOptions;
  readonly sheets: Map<number, Sheet>;
  readonly byName: Map<string, number>;
  readonly names: Map<string, NameEntry>;
  readonly tables: Map<string, TableDefinition>;
  readonly recStack: Recorder[];
  /** Ordre courant des feuilles (la liste est remplacee a chaque suppression). */
  order(): number[];
  resolveCell(sh: Sheet, row: number, col: number): Scalar;
  ensure(f: FCell): void;
}

/** Parcourt les cellules non vides d'une zone, ligne par ligne. */
function scan(host: ContextHost, area: Area, cb: (row: number, col: number, v: Scalar) => boolean | void): void {
  const sh = host.sheets.get(area.sheet);
  if (!sh) return;
  let r2 = Math.min(area.r2, sh.rows - 1);
  let c2 = Math.min(area.c2, sh.cols - 1);
  if (r2 < area.r1 || c2 < area.c1) return;
  const n = (r2 - area.r1 + 1) * (c2 - area.c1 + 1);
  const stored = sh.values.size + sh.formulas.size + sh.spill.size;
  if (n <= stored * 2 + 64) {
    // Les bornes sont relues a chaque cellule : calculer une formule peut agrandir la feuille (debordement).
    for (let r = area.r1; r <= Math.min(area.r2, sh.rows - 1); r++) {
      for (let c = area.c1; c <= Math.min(area.c2, sh.cols - 1); c++) {
        const v = host.resolveCell(sh, r, c);
        if (v !== null && cb(r, c, v) === true) return;
      }
    }
    return;
  }
  // Calcule d'abord les formules en attente : leur debordement ajoute des cellules (et agrandit l'etendue de la feuille).
  for (const [k, f] of sh.formulas) {
    if (!f.dirty) continue;
    const r = Math.floor(k / MAX_COLS);
    const c = k % MAX_COLS;
    if (r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2) host.ensure(f);
  }
  r2 = Math.min(area.r2, sh.rows - 1);
  c2 = Math.min(area.c2, sh.cols - 1);
  const keys = new Set<number>();
  for (const map of [sh.values, sh.formulas, sh.spill]) {
    for (const k of map.keys()) {
      const r = Math.floor(k / MAX_COLS);
      const c = k % MAX_COLS;
      if (r >= area.r1 && r <= r2 && c >= area.c1 && c <= c2) keys.add(k);
    }
  }
  for (const k of [...keys].sort((a, b) => a - b)) {
    const r = Math.floor(k / MAX_COLS);
    const c = k % MAX_COLS;
    const v = host.resolveCell(sh, r, c);
    if (v !== null && cb(r, c, v) === true) return;
  }
}

export function makeWorkbookContext(host: ContextHost): WorkbookContext {
  const record = (): Recorder | undefined => host.recStack[host.recStack.length - 1];
  return {
    dateSystem: host.dateSystem,
    locale: host.locale,
    host: host.options.host,
    sheetId: (name) => host.byName.get(name.toUpperCase()),
    sheetName: (id) => host.sheets.get(id)?.name,
    sheetOrder: () => host.order(),
    getCell: (s, r, c) => {
      record()?.cells.push(posKey(s, r, c));
      const sh = host.sheets.get(s);
      return sh ? host.resolveCell(sh, r, c) : ERR.REF;
    },
    usedBounds: (s) => {
      record()?.bounds.push(s);
      const sh = host.sheets.get(s);
      return { rows: sh?.rows ?? 0, cols: sh?.cols ?? 0 };
    },
    forEachCell: (area, cb) => {
      record()?.areas.push(area);
      scan(host, area, cb);
    },
    numberStats: (area) => {
      const sh = host.sheets.get(area.sheet);
      const st = sh && areaStats(area, sh.agg, sh.rows, (c, r) => host.resolveCell(sh, r, c));
      if (st) record()?.areas.push(area);
      return st;
    },
    readArea: (area) => {
      record()?.areas.push(area);
      const rows = area.r2 - area.r1 + 1;
      const cols = area.c2 - area.c1 + 1;
      const data = new Array<Scalar>(rows * cols).fill(null);
      scan(host, area, (r, c, v) => {
        data[(r - area.r1) * cols + (c - area.c1)] = v;
      });
      return new Matrix(rows, cols, data);
    },
    getName: (name, sheet): NameDefinition | undefined => {
      const up = name.toUpperCase();
      const n = host.names.get(`${sheet}|${up}`) ?? host.names.get(`|${up}`);
      return n ? { node: n.node, sheet: n.sheet } : undefined;
    },
    getTable: (name) => host.tables.get(name.toUpperCase()),
    tableAt: (s, r, c) => {
      for (const t of host.tables.values()) {
        if (t.sheet === s && r >= t.r1 && r <= t.r2 && c >= t.c1 && c <= t.c2) return t;
      }
      return undefined;
    },
    spillArea: (s, r, c) => {
      record()?.cells.push(posKey(s, r, c));
      const sh = host.sheets.get(s);
      const f = sh?.formulas.get(cellKey(r, c));
      if (!f) return undefined;
      host.ensure(f);
      const m = f.matrix;
      if (!m) return f.value instanceof FormulaError ? undefined : { sheet: s, r1: r, c1: c, r2: r, c2: c };
      return { sheet: s, r1: r, c1: c, r2: r + m.rows - 1, c2: c + m.cols - 1 };
    },
    formulaText: (s, r, c) => {
      const f = host.sheets.get(s)?.formulas.get(cellKey(r, c));
      return f ? `=${f.text}` : undefined;
    },
    now: () => jsDateToSerial(host.options.now?.() ?? new Date(), host.dateSystem),
    random: () => (host.options.random ?? Math.random)(),
  };
}
