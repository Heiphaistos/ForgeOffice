// Parcours et reecriture d'arbres de formule (noeuds du moteur), partages par les outils de formules.
import { parseFormula, printFormula, type Node } from '@forgeoffice/formulas';
import type { Workbook } from '@forgeoffice/xlsx';

/** Copie de l'arbre ou `fn` remplace les noeuds qu'il veut (renvoie undefined pour descendre). */
export function mapNode(n: Node, fn: (n: Node) => Node | undefined): Node {
  const replaced = fn(n);
  if (replaced) return replaced;
  switch (n.type) {
    case 'unary': case 'postfix': case 'paren': return { ...n, arg: mapNode(n.arg, fn) };
    case 'binary': return { ...n, left: mapNode(n.left, fn), right: mapNode(n.right, fn) };
    case 'call': return { ...n, args: n.args.map((a) => mapNode(a, fn)) };
    case 'invoke': return { ...n, callee: mapNode(n.callee, fn), args: n.args.map((a) => mapNode(a, fn)) };
    default: return n;
  }
}

/** Visite chaque noeud (parent avant enfants). */
export function walk(n: Node, fn: (n: Node) => void): void {
  fn(n);
  switch (n.type) {
    case 'unary': case 'postfix': case 'paren': walk(n.arg, fn); break;
    case 'binary': walk(n.left, fn); walk(n.right, fn); break;
    case 'call': for (const a of n.args) walk(a, fn); break;
    case 'invoke': walk(n.callee, fn); for (const a of n.args) walk(a, fn); break;
    default:
  }
}

/** Formule dont chaque utilisation du nom `from` devient `to` ; la formule d'origine si elle n'en contient pas ou si elle est illisible. */
export function renameNameIn(formula: string, from: string, to: string): string {
  if (!formula.toLowerCase().includes(from.toLowerCase())) return formula;
  try {
    let changed = false;
    const ast = mapNode(parseFormula(formula), (n) => {
      if (n.type !== 'name' || n.name.toLowerCase() !== from.toLowerCase()) return undefined;
      changed = true;
      return { ...n, name: to };
    });
    return changed ? printFormula(ast) : formula;
  } catch {
    return formula; // formule que l'analyseur refuse : laissee telle quelle
  }
}

/** Classeur ou le nom `from` est renomme `to` dans toutes les formules de cellules et dans les autres noms (Excel fait de meme). */
export function renameNameInWorkbook(wb: Workbook, from: string, to: string): void {
  wb.definedNames = wb.definedNames.map((n) => {
    const formula = renameNameIn(n.formula, from, to);
    return formula === n.formula ? n : { ...n, formula };
  });
  wb.sheets = wb.sheets.map((sh) => {
    let cells: typeof sh.cells | null = null;
    for (const [row, line] of sh.cells) {
      for (const [col, cell] of line) {
        if (cell.formula === undefined) continue;
        const formula = renameNameIn(cell.formula, from, to);
        if (formula === cell.formula) continue;
        cells ??= new Map([...sh.cells].map(([r, l]) => [r, new Map(l)]));
        cells.get(row)?.set(col, { ...cell, formula });
      }
    }
    return cells ? { ...sh, cells } : sh;
  });
}
