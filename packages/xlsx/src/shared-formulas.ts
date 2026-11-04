// Formules partagees : la cellule maitre porte la formule et la plage ; les autres cellules du groupe
// n'ont que l'index. L'expansion demande une fonction de translation (fournie par le moteur de formules).
import type { CellRange, Workbook } from './model.ts';
import { columnIndex, columnName, rangeContains } from './address.ts';

/**
 * Translate une formule maitre de (rowOffset, colOffset) : references relatives decalees, absolues conservees.
 * Fournie par @forgeoffice/formulas ; `translateA1Simple` sert de repli.
 */
export type FormulaTranslator = (formula: string, rowOffset: number, colOffset: number) => string;

interface Master {
  row: number;
  col: number;
  formula: string;
  ref: CellRange;
}

/**
 * Ecrit la formule translatee sur chaque cellule dependante d'un groupe partage puis retire les
 * informations de partage (les cellules deviennent des formules ordinaires). Renvoie le nombre de
 * cellules developpees. Une dependante dont le maitre est introuvable perd seulement le partage.
 */
export function expandSharedFormulas(wb: Workbook, translate: FormulaTranslator): number {
  let expanded = 0;
  for (const sheet of wb.sheets) {
    const masters = new Map<number, Master>();
    for (const [row, line] of sheet.cells) {
      for (const [col, cell] of line) {
        if (cell.shared?.ref && cell.formula !== undefined) {
          masters.set(cell.shared.index, { row, col, formula: cell.formula, ref: cell.shared.ref });
        }
      }
    }
    for (const [row, line] of sheet.cells) {
      for (const [col, cell] of line) {
        if (!cell.shared) continue;
        const master = masters.get(cell.shared.index);
        if (master && !(master.row === row && master.col === col) && rangeContains(master.ref, row, col)) {
          cell.formula = translate(master.formula, row - master.row, col - master.col);
          expanded++;
        }
        delete cell.shared;
      }
    }
  }
  return expanded;
}

const REF_RE = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![\w(!.])/y;

/**
 * Translation A1 simple (sans analyse syntaxique complete) : decale les references de cellule
 * relatives hors chaines de caracteres et hors noms de feuille cites. Suffit pour les formules
 * partagees ordinaires (« A1*2 », « SUM($A1:B1) », « Feuil2!C3 »).
 */
export function translateA1Simple(formula: string, rowOffset: number, colOffset: number): string {
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula.charAt(i);
    if (ch === '"') {
      const end = findStringEnd(formula, i);
      out += formula.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "'") {
      const end = formula.indexOf("'!", i + 1);
      const stop = end < 0 ? formula.length : end + 2;
      out += formula.slice(i, stop);
      i = stop;
      continue;
    }
    const prev = i > 0 ? formula.charAt(i - 1) : '';
    if (!/[A-Za-z0-9_.]/.test(prev)) {
      REF_RE.lastIndex = i;
      const m = formula.match(REF_RE);
      if (m) {
        const [whole, colAbs = '', letters = '', rowAbs = '', digits = ''] = m;
        const col = columnIndex(letters);
        const row = Number(digits) - 1;
        const newCol = colAbs ? col : col + colOffset;
        const newRow = rowAbs ? row : row + rowOffset;
        out += newCol < 0 || newRow < 0 || newCol > 16383 || newRow > 1048575
          ? '#REF!'
          : `${colAbs}${columnName(newCol)}${rowAbs}${newRow + 1}`;
        i += whole.length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

function findStringEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    if (text.charAt(i) === '"') {
      if (text.charAt(i + 1) === '"') {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return text.length;
}
