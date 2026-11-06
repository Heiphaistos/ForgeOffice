// Types de l'evaluation : references, LAMBDA, contexte classeur.
import type { DateSystem } from '../format/dates.ts';
import type { NumberLocale } from '../format/locale.ts';
import type { Node } from '../parse/ast.ts';
import type { Area } from '../refs.ts';
import type { Matrix, Scalar, Value } from '../values.ts';

/** Reference (une ou plusieurs zones) non encore lue. */
export class RefValue {
  readonly areas: Area[];
  constructor(areas: Area[]) {
    this.areas = areas;
  }
  get single(): boolean {
    const a = this.areas[0];
    return this.areas.length === 1 && a !== undefined && a.r1 === a.r2 && a.c1 === a.c2;
  }
}

export interface Scope {
  vars: Map<string, EvalValue>;
  /** Parametres LAMBDA omis lors de l'appel (ISOMITTED / ESTOMIS). */
  omitted: Set<string>;
  parent: Scope | undefined;
}

/** Fonction LAMBDA (ou fonction integree utilisee comme LAMBDA : BYROW(A1:B3;SUM)). */
export class LambdaValue {
  readonly params: string[];
  readonly body: Node | undefined;
  readonly scope: Scope | undefined;
  readonly builtin: string | undefined;
  constructor(params: string[], body: Node | undefined, scope: Scope | undefined, builtin?: string) {
    this.params = params;
    this.body = body;
    this.scope = scope;
    this.builtin = builtin;
  }
}

export type EvalValue = Value | RefValue | LambdaValue;

export interface NameDefinition {
  node: Node;
  /** Feuille de reference pour les references relatives du nom. */
  sheet?: number | undefined;
}

export interface TableDefinition {
  name: string;
  sheet: number;
  /** Zone complete (en-tetes et totaux compris). */
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  columns: string[];
  headerRow: boolean;
  totalsRow: boolean;
}

/** Mise en forme d'une cellule lue par CELLULE (le moteur de formules ne gere pas les styles). */
export interface CellStyleInfo {
  /** Code de format de nombre canonique (ex. "#,##0.00"). */
  numFmt?: string | undefined;
  /** Cellule verrouillee (vrai par defaut). */
  locked?: boolean | undefined;
  /** Alignement horizontal. */
  align?: 'general' | 'left' | 'right' | 'center' | 'fill' | 'justify' | 'distributed' | 'centerContinuous' | undefined;
}

/** Informations de l'application hote pour CELLULE et INFORMATIONS. */
export interface HostInfo {
  /** Chemin complet du classeur ("C:\Docs\Classeur.xlsx") ; vide si non enregistre. */
  fileName?: string | undefined;
  /** Dossier courant (INFORMATIONS("repertoire")). */
  directory?: string | undefined;
  osVersion?: string | undefined;
  cellStyle?(sheet: string, row: number, col: number): CellStyleInfo | undefined;
  /** Largeur de colonne en caracteres. */
  columnWidth?(sheet: string, col: number): number | undefined;
  /** Valeur d'un tableau croise (LIREDONNEESTABCROISDYNAMIQUE) : feuille et cellule du tableau, champ de donnees, paires champ/element. */
  pivotValue?(sheet: string, row: number, col: number, dataField: string, items: [string, Scalar][]): Scalar | undefined;
}

/** Acces au classeur requis par l'evaluateur (fourni par FormulaEngine ou par un contexte simple). */
export interface WorkbookContext {
  readonly dateSystem: DateSystem;
  readonly locale: NumberLocale;
  sheetId(name: string): number | undefined;
  sheetName(id: number): string | undefined;
  /** Identifiants des feuilles dans l'ordre des onglets. */
  sheetOrder(): number[];
  /** Valeur calculee d'une cellule (calcule a la demande si necessaire). */
  getCell(sheet: number, row: number, col: number): Scalar;
  /** Nombre de lignes / colonnes utilisees (derniere cellule non vide + 1). */
  usedBounds(sheet: number): { rows: number; cols: number };
  /** Parcourt les cellules non vides d'une zone. Le rappel renvoie true pour arreter. */
  forEachCell(area: Area, cb: (row: number, col: number, v: Scalar) => boolean | void): void;
  /** Application hote (styles, chemin du fichier) : facultative. */
  readonly host?: HostInfo | undefined;
  getName(name: string, sheet: number): NameDefinition | undefined;
  getTable(name: string): TableDefinition | undefined;
  tableAt(sheet: number, row: number, col: number): TableDefinition | undefined;
  /** Zone de debordement d'une formule matricielle dynamique (pour A1#). */
  spillArea(sheet: number, row: number, col: number): Area | undefined;
  formulaText(sheet: number, row: number, col: number): string | undefined;
  /** Date et heure courantes en numero de serie. */
  now(): number;
  random(): number;
  /** Somme et effectif des nombres d'une grande zone sans erreur, en cache (undefined = lire cellule par cellule). */
  numberStats?(area: Area): { sum: number; count: number } | undefined;
  /** Lecture directe d'une zone (facultative : sinon cellule par cellule). */
  readArea?(area: Area): Matrix;
  /** Ligne masquee (filtre ou masquage manuel) : ignoree par SOUS.TOTAL 101-111 et AGREGAT. */
  rowHidden?(sheet: number, row: number): boolean;
}

/** Contexte d'un appel de fonction ou d'une evaluation. */
export interface EvalContext {
  wb: WorkbookContext;
  sheet: number;
  row: number;
  col: number;
  scope: Scope | undefined;
  /** Profondeur d'appels LAMBDA / noms (garde contre la recursion infinie). */
  depth: number;
}

/** Services d'evaluation passes aux fonctions (evite les imports circulaires). */
export interface Evaluator {
  evaluate(node: Node, ctx: EvalContext): EvalValue;
  callLambda(fn: LambdaValue, args: EvalValue[], ctx: EvalContext): EvalValue;
}
