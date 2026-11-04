// Modele Texte : styles et numerotation (listes).
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { ParagraphProps, RunProps } from './model-props.ts';
import type { TableCellProps, TableProps } from './model-table.ts';

export type StyleType = 'paragraph' | 'character' | 'table' | 'numbering';

export type TableRegion =
  | 'wholeTable' | 'firstRow' | 'lastRow' | 'firstCol' | 'lastCol' | 'band1Vert' | 'band2Vert'
  | 'band1Horz' | 'band2Horz' | 'neCell' | 'nwCell' | 'seCell' | 'swCell';

export interface TableConditionalFormat {
  region: TableRegion;
  paragraph?: ParagraphProps;
  run?: RunProps;
  table?: TableProps;
  cell?: TableCellProps;
}

export interface Style {
  id: string;
  type: StyleType;
  /** Nom interne (« heading 1 », « Normal », « Mon style »). Voir styleDisplayName() pour le nom francais. */
  name: string;
  basedOn?: string;
  /** Style du paragraphe suivant (Entree a la fin d'un titre -> Normal). */
  next?: string;
  /** Style lie (paragraphe <-> caractere). */
  link?: string;
  /** Style par defaut de son type. */
  isDefault?: boolean;
  /** Style cree par l'utilisateur (non integre). */
  custom?: boolean;
  uiPriority?: number;
  hidden?: boolean;
  semiHidden?: boolean;
  unhideWhenUsed?: boolean;
  /** Affiche dans la galerie Styles du ruban. */
  quickFormat?: boolean;
  paragraph?: ParagraphProps;
  run?: RunProps;
  table?: TableProps;
  tableCell?: TableCellProps;
  tableConditional?: TableConditionalFormat[];
}

export interface StyleSheet {
  docDefaults: { run: RunProps; paragraph: ParagraphProps };
  styles: Style[];
  /** Liste des styles latents (w:latentStyles) conservee telle quelle. */
  latentStyles?: XmlElement;
}

// ---------------------------------------------------------------------------------------------------
// Numerotation (listes)
// ---------------------------------------------------------------------------------------------------

export type NumberFormat =
  | 'decimal' | 'decimalZero' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman'
  | 'bullet' | 'ordinal' | 'cardinalText' | 'ordinalText' | 'decimalEnclosedCircle' | 'none';

export interface NumberingLevel {
  /** 0..8. */
  level: number;
  format: NumberFormat;
  /** Gabarit du texte : « %1. », « %1.%2. », « • ». */
  text: string;
  start: number;
  alignment: 'left' | 'center' | 'right';
  /** Separateur entre le numero et le texte. */
  suffix: 'tab' | 'space' | 'nothing';
  /** Recommence apres ce niveau (0 = jamais ; absent = apres tout niveau superieur). */
  restartAfter?: number;
  /** Numerotation legale (1.1.1 en chiffres arabes). */
  isLegal?: boolean;
  /** Style de paragraphe associe (« Titre 1 » dans une liste hierarchisee). */
  styleId?: string;
  paragraph?: ParagraphProps;
  run?: RunProps;
}

export interface AbstractNumbering {
  id: number;
  name?: string;
  multiLevelType?: 'singleLevel' | 'multilevel' | 'hybridMultilevel';
  levels: NumberingLevel[];
  styleLink?: string;
  numStyleLink?: string;
}

export interface NumberingOverride {
  level: number;
  /** Redemarrage de la numerotation a cette valeur. */
  startOverride?: number;
  /** Niveau completement redefini. */
  definition?: NumberingLevel;
}

export interface NumberingInstance {
  id: number;
  abstractId: number;
  overrides: NumberingOverride[];
}

export interface Numbering {
  abstracts: AbstractNumbering[];
  instances: NumberingInstance[];
}
