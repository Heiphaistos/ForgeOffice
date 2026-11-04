// Types du moteur de classeur : options et notifications publiques, etat interne des feuilles et des formules.
import type { DateSystem } from '../format/dates.ts';
import type { NumberLocale } from '../format/locale.ts';
import type { Node } from '../parse/ast.ts';
import type { Matrix, Scalar } from '../values.ts';

export interface EngineOptions {
  dateSystem?: DateSystem;
  /** Region des conversions texte <-> nombre ('fr-FR' par defaut). */
  locale?: NumberLocale;
  /** Horloge de MAINTENANT/AUJOURDHUI (date courante par defaut). */
  now?: () => Date;
  random?: () => number;
  /** Calcul iteratif des references circulaires (desactive par defaut, comme Excel). */
  iterative?: boolean;
  maxIterations?: number;
  maxChange?: number;
}

export interface CellChange {
  sheet: string;
  row: number;
  col: number;
}

export type ChangeListener = (changes: CellChange[]) => void;

export interface TableInput {
  name: string;
  sheet: string;
  /** Zone complete, ex. "A1:D20" (en-tetes et totaux compris). */
  ref: string;
  columns?: string[];
  headerRow?: boolean;
  totalsRow?: boolean;
}

export interface Sheet {
  id: number;
  name: string;
  values: Map<number, Scalar>;
  formulas: Map<number, FCell>;
  /** Cellule -> formule dont le resultat deborde dessus. */
  spill: Map<number, FCell>;
  /** Etendue utilisee (derniere ligne/colonne + 1). */
  rows: number;
  cols: number;
}

export interface FCell {
  sheet: Sheet;
  row: number;
  col: number;
  /** Formule canonique sans '='. */
  text: string;
  ast: Node;
  volatile: boolean;
  dirty: boolean;
  computing: boolean;
  dead: boolean;
  value: Scalar;
  /** Resultat matriciel deborde (undefined si scalaire ou #EPARS!). */
  matrix: Matrix | undefined;
}

export interface NameEntry {
  text: string;
  node: Node;
  sheet: number | undefined;
}
