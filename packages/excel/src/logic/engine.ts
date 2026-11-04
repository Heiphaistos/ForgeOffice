// Liaison classeur (modele immuable de @forgeoffice/xlsx) <-> moteur de formules (@forgeoffice/formulas).
// Le classeur est la source de verite ; le moteur est synchronise par difference d'identite des objets
// (les lignes non modifiees sont partagees entre deux etats, donc la comparaison est rapide).
import {
  FormulaEngine, FormulaError, FormulaParseError, err, parseRangeAddress, translateFormula, type Scalar,
} from '@forgeoffice/formulas';
import {
  expandSharedFormulas, rangeContains, type Cell, type CellRange, type CellValue, type Sheet, type Workbook,
} from '@forgeoffice/xlsx';

/** Valeur du modele -> valeur du moteur. */
export function toScalar(v: CellValue | undefined): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return err(v.error);
  return v;
}

/** Valeur du moteur -> valeur du modele (cache des formules a l'enregistrement). */
export function fromScalar(v: Scalar): CellValue {
  if (v instanceof FormulaError) return { error: v.code };
  return v;
}

/** Developpe les formules partagees d'un classeur fraichement lu (mutation acceptee : rien n'est encore publie). */
export function prepareLoaded(wb: Workbook): Workbook {
  expandSharedFormulas(wb, (f, dr, dc) => translateFormula(f, dr, dc));
  return wb;
}

export class WorkbookEngine {
  readonly engine: FormulaEngine;
  private current: Workbook | null = null;
  /** Formules refusees par l'analyseur (conservees telles quelles dans le fichier). */
  readonly invalid = new Set<string>();

  constructor(date1904 = false) {
    this.engine = new FormulaEngine({ dateSystem: date1904 ? 1904 : 1900, locale: 'fr-FR' });
  }

  get workbook(): Workbook | null {
    return this.current;
  }

  /** Synchronise le moteur sur un nouvel etat du classeur. */
  sync(next: Workbook): void {
    const prev = this.current;
    this.current = next;
    if (!prev || structureChanged(prev, next)) {
      this.rebuild(next);
      return;
    }
    this.engine.batch(() => {
      next.sheets.forEach((sh, i) => {
        const old = prev.sheets[i];
        if (old && old.cells !== sh.cells) this.diffSheet(sh.name, old, sh);
      });
    });
  }

  value(sheet: string, row: number, col: number): Scalar {
    return this.engine.getValue(sheet, { row, col });
  }

  private rebuild(wb: Workbook): void {
    const names = this.engine.sheetNames();
    // Le moteur exige au moins une feuille : on ajoute d'abord, on retire ensuite.
    const temp = `__fo${Date.now()}`;
    this.engine.addSheet(temp);
    for (const n of names) this.engine.removeSheet(n);
    for (const n of this.engine.definedNames()) this.engine.removeName(n.name, n.scope);
    this.invalid.clear();
    this.engine.batch(() => {
      for (const sh of wb.sheets) this.engine.addSheet(sh.name);
      this.engine.removeSheet(temp);
      for (const sh of wb.sheets) {
        const arrays = sh.cells.size > 0 ? arrayFollowers(sh) : [];
        for (const [row, line] of sh.cells) {
          for (const [col, cell] of line) {
            if (cell.formula === undefined && arrays.some((a) => rangeContains(a, row, col) && !(a.r1 === row && a.c1 === col))) continue;
            this.put(sh.name, row, col, cell);
          }
        }
        for (const t of sh.tables) {
          try {
            this.engine.defineTable({
              name: t.displayName || t.name, sheet: sh.name, ref: rangeRef(t.ref),
              columns: t.columns.map((c) => c.name), headerRow: t.headerRowCount > 0, totalsRow: t.totalsRowCount > 0,
            });
          } catch (e) {
            this.invalid.add(`${t.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
      for (const d of wb.definedNames) {
        if (d.name.startsWith('_xlnm.')) continue;
        try {
          const scope = d.localSheet === undefined ? undefined : wb.sheets[d.localSheet]?.name;
          this.engine.defineName(d.name, d.formula, scope);
        } catch (e) {
          this.invalid.add(`${d.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });
  }

  private diffSheet(name: string, a: Sheet, b: Sheet): void {
    for (const [row, line] of b.cells) {
      const old = a.cells.get(row);
      if (old === line) continue;
      for (const [col, cell] of line) {
        const prev = old?.get(col);
        if (prev !== cell && !sameContent(prev, cell)) this.put(name, row, col, cell);
      }
      if (old) for (const col of old.keys()) if (!line.has(col)) this.engine.setCell(name, { row, col }, null);
    }
    for (const [row, old] of a.cells) {
      if (b.cells.has(row)) continue;
      for (const col of old.keys()) this.engine.setCell(name, { row, col }, null);
    }
  }

  private put(sheet: string, row: number, col: number, cell: Cell): void {
    if (cell.formula !== undefined && cell.formula !== '') {
      try {
        this.engine.setFormula(sheet, { row, col }, cell.formula);
        return;
      } catch (e) {
        if (!(e instanceof FormulaParseError)) throw e;
        this.invalid.add(`${sheet}!${row},${col}`);
      }
    }
    this.engine.setCell(sheet, { row, col }, toScalar(cell.value));
  }
}

function sameContent(a: Cell | undefined, b: Cell): boolean {
  if (!a) return b.value === null && b.formula === undefined;
  if (a.formula !== b.formula) return false;
  if (b.formula !== undefined) return true;
  const x = a.value;
  const y = b.value;
  if (typeof x === 'object' && x && typeof y === 'object' && y) return x.error === y.error;
  return x === y;
}

function structureChanged(a: Workbook, b: Workbook): boolean {
  if (a.date1904 !== b.date1904 || a.definedNames !== b.definedNames || a.sheets.length !== b.sheets.length) return true;
  return a.sheets.some((s, i) => {
    const t = b.sheets[i];
    return !t || t.name !== s.name || t.tables !== s.tables;
  });
}

/** Plages des formules matricielles historiques (les cellules suiveuses ne portent qu'un cache). */
function arrayFollowers(sh: Sheet): CellRange[] {
  const out: CellRange[] = [];
  for (const line of sh.cells.values()) for (const cell of line.values()) if (cell.array && !cell.array.dynamic) out.push(cell.array.ref);
  return out;
}

function rangeRef(r: CellRange): string {
  const col = (c: number): string => {
    let n = c + 1;
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  return `${col(r.c1)}${r.r1 + 1}:${col(r.c2)}${r.r2 + 1}`;
}

/** Valeurs calculees ecrites dans le cache des formules (avant enregistrement). */
export function withCachedValues(wb: Workbook, eng: WorkbookEngine): Workbook {
  const sheets = wb.sheets.map((sh) => {
    let cells: Map<number, Map<number, Cell>> | null = null;
    for (const [row, line] of sh.cells) {
      for (const [col, cell] of line) {
        if (cell.formula === undefined) continue;
        const v = fromScalar(eng.value(sh.name, row, col));
        if (!cells) cells = new Map([...sh.cells].map(([r, l]) => [r, new Map(l)]));
        cells.get(row)?.set(col, { ...cell, value: v });
      }
    }
    return cells ? { ...sh, cells } : sh;
  });
  return { ...wb, sheets };
}

/** Valeurs d'une plage « Feuil1!$A$1:$B$4 » (ou locale a `sheet`), ligne par ligne. */
export function rangeValues(eng: WorkbookEngine, ref: string, sheet: string): Scalar[][] {
  const bang = ref.lastIndexOf('!');
  const sheetName = bang < 0 ? sheet : ref.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'");
  const area = parseRangeAddress((bang < 0 ? ref : ref.slice(bang + 1)).replace(/\$/g, ''));
  if (!area) return [];
  const out: Scalar[][] = [];
  const r2 = Math.min(area.r2, area.r1 + 10_000);
  const c2 = Math.min(area.c2, area.c1 + 500);
  for (let r = area.r1; r <= r2; r++) {
    const line: Scalar[] = [];
    for (let c = area.c1; c <= c2; c++) {
      try {
        line.push(eng.value(sheetName, r, c));
      } catch {
        line.push(err('#REF!'));
      }
    }
    out.push(line);
  }
  return out;
}
