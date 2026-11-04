// Arbre syntaxique des formules.
import type { ErrorCode } from '../values.ts';

export type RefKind = 'cell' | 'area' | 'cols' | 'rows';

/** Reference A1 : coordonnees absolues en base 0 + indicateurs `$`. */
export interface RefNode {
  type: 'ref';
  /** Feuille explicite (undefined = feuille de la formule). */
  sheet?: string | undefined;
  /** Derniere feuille d'une reference 3D (Feuil1:Feuil3!A1). */
  sheet2?: string | undefined;
  /** Prefixe de classeur externe brut, ex. "[1]". */
  book?: string | undefined;
  /** Feuille supprimee : s'affiche #REF!A1. */
  sheetError?: boolean | undefined;
  kind: RefKind;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  ar1: boolean;
  ac1: boolean;
  ar2: boolean;
  ac2: boolean;
}

export type TableSpecial = '#All' | '#Data' | '#Headers' | '#Totals' | '#This Row';

export interface TableNode {
  type: 'table';
  /** Nom du tableau ('' pour [@Colonne] ecrit dans le tableau lui-meme). */
  table: string;
  specials: TableSpecial[];
  col1?: string | undefined;
  col2?: string | undefined;
}

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '&'
  | '='
  | '<>'
  | '<'
  | '>'
  | '<='
  | '>='
  | ':'
  | ','
  | ' ';

export type Node =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'err'; code: ErrorCode }
  | RefNode
  | { type: 'name'; name: string; sheet?: string | undefined }
  | TableNode
  | { type: 'array'; rows: Node[][] }
  | { type: 'unary'; op: '+' | '-' | '@'; arg: Node }
  | { type: 'postfix'; op: '%' | '#'; arg: Node }
  | { type: 'binary'; op: BinaryOp; left: Node; right: Node }
  | { type: 'paren'; arg: Node }
  | { type: 'call'; name: string; args: Node[] }
  | { type: 'invoke'; callee: Node; args: Node[] }
  | { type: 'missing' };

export type CallNode = Extract<Node, { type: 'call' }>;
export type NameNode = Extract<Node, { type: 'name' }>;
