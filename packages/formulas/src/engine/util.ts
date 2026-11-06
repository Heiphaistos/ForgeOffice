// Utilitaires du moteur : volatilite d'une formule, egalite de valeurs, erreurs a gabarit, evaluation reportee.
import { getFunction } from '../functions/registry.ts';
import type { Node } from '../parse/ast.ts';
import { FormulaError, type Scalar } from '../values.ts';
import type { FCell } from './types.ts';

/** Evaluation reportee : la chaine de dependances est trop profonde pour la pile. */
export class Defer {
  readonly cell: FCell;
  constructor(cell: FCell) {
    this.cell = cell;
  }
}

export const MAX_DEPTH = 120;
export const SHEET_NAME_BAD = /[:\\/?*[\]]/;
export const NAME_RE = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*$/;

export function isVolatile(n: Node): boolean {
  switch (n.type) {
    case 'call':
      return (getFunction(n.name)?.volatile ?? false) || n.args.some(isVolatile);
    case 'invoke':
      return isVolatile(n.callee) || n.args.some(isVolatile);
    case 'unary':
    case 'postfix':
    case 'paren':
      return isVolatile(n.arg);
    case 'binary':
      return isVolatile(n.left) || isVolatile(n.right);
    case 'array':
      return n.rows.some((r) => r.some(isVolatile));
    default:
      return false;
  }
}

export function sameScalar(a: Scalar, b: Scalar): boolean {
  if (a instanceof FormulaError && b instanceof FormulaError) return a.code === b.code;
  return a === b;
}

export function fail(template: string, arg: string): never {
  throw new Error(template.replace('{0}', arg));
}

/** Fonctions dont le resultat depend de la structure du classeur (feuilles, noms, position) sans la lire cellule par cellule. */
const STRUCTURE_SENSITIVE = new Set([
  'INDIRECT', 'SHEET', 'SHEETS', 'CELL', 'INFO', 'FORMULATEXT', 'ISFORMULA', 'GETPIVOTDATA',
]);

export function isStructureSensitive(n: Node): boolean {
  switch (n.type) {
    case 'call':
      return STRUCTURE_SENSITIVE.has(n.name.toUpperCase()) || n.args.some(isStructureSensitive);
    case 'invoke':
      return isStructureSensitive(n.callee) || n.args.some(isStructureSensitive);
    case 'unary':
    case 'postfix':
    case 'paren':
      return isStructureSensitive(n.arg);
    case 'binary':
      return isStructureSensitive(n.left) || isStructureSensitive(n.right);
    case 'array':
      return n.rows.some((r) => r.some(isStructureSensitive));
    default:
      return false;
  }
}
