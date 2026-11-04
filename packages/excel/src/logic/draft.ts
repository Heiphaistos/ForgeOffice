// Brouillon de modification d'un classeur immuable : copie a l'ecriture (feuille clonee une fois,
// lignes de cellules clonees a la demande). Les etats precedents restent intacts pour annuler/retablir.
// Regle : les objets d'un etat publie ne sont jamais modifies en place ; on les remplace.
import type { Cell, CellRange, Sheet, Workbook } from '@forgeoffice/xlsx';

export class Draft {
  readonly wb: Workbook;
  /** Feuilles deja clonees (par identite : l'ordre des feuilles peut changer dans le brouillon). */
  private readonly owned = new Map<Sheet, Set<number>>();

  constructor(base: Workbook) {
    this.wb = { ...base, sheets: [...base.sheets] };
  }

  /**
   * Feuille modifiable (clonee au premier acces). `cells` et `rows` sont copies et modifiables en place ;
   * les autres tableaux et objets doivent etre REMPLACES (identite = signal de changement pour le moteur).
   */
  sheet(index: number): Sheet {
    const s = this.wb.sheets[index];
    if (!s) throw new RangeError(`sheet ${index}`);
    if (this.owned.has(s)) return s;
    const copy: Sheet = {
      ...s,
      cells: new Map(s.cells),
      rows: new Map(s.rows),
    };
    this.wb.sheets[index] = copy;
    this.owned.set(copy, new Set());
    return copy;
  }

  get(index: number, row: number, col: number): Cell | undefined {
    return this.wb.sheets[index]?.cells.get(row)?.get(col);
  }

  /** Ecrit (ou supprime avec undefined) une cellule. */
  set(index: number, row: number, col: number, cell: Cell | undefined): void {
    const sh = this.sheet(index);
    const cloned = this.owned.get(sh) ?? new Set<number>();
    let line = sh.cells.get(row);
    if (!line) {
      if (!cell) return;
      line = new Map();
      sh.cells.set(row, line);
      cloned.add(row);
    } else if (!cloned.has(row)) {
      line = new Map(line);
      sh.cells.set(row, line);
      cloned.add(row);
    }
    if (cell) line.set(col, cell);
    else {
      line.delete(col);
      if (line.size === 0) sh.cells.delete(row);
    }
  }

  /** Remplace toutes les cellules d'une feuille (tri, insertion de lignes...). */
  replaceCells(index: number, cells: Map<number, Map<number, Cell>>): void {
    const sh = this.sheet(index);
    sh.cells = cells;
    this.owned.set(sh, new Set(cells.keys()));
  }

  /** Parcourt les cellules existantes d'une plage (sans visiter les cellules vides). */
  forEachIn(index: number, r: CellRange, fn: (row: number, col: number, cell: Cell) => void): void {
    const sh = this.wb.sheets[index];
    if (!sh) return;
    forEachCell(sh, r, fn);
  }
}

/** Cellules existantes d'une plage, sans parcourir les zones vides (plages de lignes/colonnes entieres). */
export function forEachCell(sh: Sheet, r: CellRange, fn: (row: number, col: number, cell: Cell) => void): void {
  const height = r.r2 - r.r1 + 1;
  const rowKeys = height > sh.cells.size ? [...sh.cells.keys()].filter((k) => k >= r.r1 && k <= r.r2).sort((a, b) => a - b) : null;
  const rows = rowKeys ?? range(r.r1, r.r2);
  for (const row of rows) {
    const line = sh.cells.get(row);
    if (!line) continue;
    const width = r.c2 - r.c1 + 1;
    if (width > line.size) {
      for (const col of [...line.keys()].sort((a, b) => a - b)) {
        if (col < r.c1 || col > r.c2) continue;
        const cell = line.get(col);
        if (cell) fn(row, col, cell);
      }
    } else {
      for (let col = r.c1; col <= r.c2; col++) {
        const cell = line.get(col);
        if (cell) fn(row, col, cell);
      }
    }
  }
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
