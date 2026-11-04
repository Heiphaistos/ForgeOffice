// Insertion / suppression de lignes et de colonnes : deplacement des cellules d'une feuille et des tableaux.
import type { TableDefinition } from '../eval/types.ts';
import { MAX_COLS, MAX_ROWS, cellKey } from '../refs.ts';
import { STRINGS } from '../strings.ts';
import type { Scalar } from '../values.ts';
import { shiftSpan, type StructuralShift } from './adjust.ts';
import type { FCell, Sheet } from './types.ts';

/** Nouvelle cle d'une cellule apres le decalage ; undefined si la cellule est supprimee. */
export type CellMover = (key: number) => number | undefined;

export function makeMover(shift: StructuralShift): CellMover {
  const rows = shift.axis === 'row';
  const max = rows ? MAX_ROWS : MAX_COLS;
  return (k) => {
    const r = Math.floor(k / MAX_COLS);
    const c = k % MAX_COLS;
    const s = shiftSpan(rows ? r : c, rows ? r : c, shift.at, shift.count, max);
    if (!s) return undefined;
    return rows ? cellKey(s[0], c) : cellKey(r, s[0]);
  };
}

/**
 * Deplace les valeurs et formules de la feuille. `note` signale chaque position touchee (anciennes puis
 * nouvelles) ; `onDead` recoit les formules supprimees par le decalage.
 */
export function remapSheetCells(
  sh: Sheet,
  move: CellMover,
  note: (row: number, col: number) => void,
  onDead: (f: FCell) => void,
): void {
  for (const k of [...sh.values.keys(), ...sh.formulas.keys(), ...sh.spill.keys()]) {
    note(Math.floor(k / MAX_COLS), k % MAX_COLS);
  }
  const values = new Map<number, Scalar>();
  for (const [k, v] of sh.values) {
    const nk = move(k);
    if (nk !== undefined) values.set(nk, v);
  }
  const formulas = new Map<number, FCell>();
  for (const [k, f] of sh.formulas) {
    const nk = move(k);
    if (nk === undefined) {
      onDead(f);
      continue;
    }
    f.row = Math.floor(nk / MAX_COLS);
    f.col = nk % MAX_COLS;
    formulas.set(nk, f);
  }
  sh.values = values;
  sh.formulas = formulas;
  sh.spill.clear();
  sh.rows = 0;
  sh.cols = 0;
  for (const k of [...values.keys(), ...formulas.keys()]) {
    sh.rows = Math.max(sh.rows, Math.floor(k / MAX_COLS) + 1);
    sh.cols = Math.max(sh.cols, (k % MAX_COLS) + 1);
    note(Math.floor(k / MAX_COLS), k % MAX_COLS);
  }
}

/** Decale (ou supprime) les tableaux de la feuille `sheetId` et met a jour leurs colonnes. */
export function shiftTables(tables: Map<string, TableDefinition>, sheetId: number, shift: StructuralShift, move: CellMover): void {
  const rows = shift.axis === 'row';
  const max = rows ? MAX_ROWS : MAX_COLS;
  for (const [name, t] of tables) {
    if (t.sheet !== sheetId) continue;
    const s = rows ? shiftSpan(t.r1, t.r2, shift.at, shift.count, max) : shiftSpan(t.c1, t.c2, shift.at, shift.count, max);
    if (!s) tables.delete(name);
    else if (rows) [t.r1, t.r2] = s;
    else {
      const first = t.c1;
      const cols = t.columns;
      [t.c1, t.c2] = s;
      if (shift.count < 0) t.columns = cols.filter((_, i) => move(cellKey(0, first + i)) !== undefined);
      else if (shift.at > first && shift.at < first + cols.length) {
        const at = shift.at - first;
        const added = Array.from({ length: shift.count }, (_, i) =>
          STRINGS.engine.defaultColumn.replace('{0}', String(cols.length + i + 1)),
        );
        t.columns = [...cols.slice(0, at), ...added, ...cols.slice(at)];
      }
    }
  }
}
