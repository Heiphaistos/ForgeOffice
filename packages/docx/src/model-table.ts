// Modele Texte : tableaux.
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { Block, Revision } from './model-blocks.ts';
import type { Border, Shading } from './model-props.ts';
import type { Pt } from './model.ts';

export type WidthType = 'pt' | 'pct' | 'auto' | 'nil';

export interface Width {
  /** Points si type = pt ; pourcentage 0..100 si type = pct. */
  value: number;
  type: WidthType;
}

export interface CellMargins {
  top?: Pt;
  right?: Pt;
  bottom?: Pt;
  left?: Pt;
}

export interface TableBorders {
  top?: Border;
  bottom?: Border;
  left?: Border;
  right?: Border;
  insideH?: Border;
  insideV?: Border;
}

export interface TableLook {
  firstRow: boolean;
  lastRow: boolean;
  firstColumn: boolean;
  lastColumn: boolean;
  noHBand: boolean;
  noVBand: boolean;
}

export interface TableProps {
  width?: Width;
  alignment?: 'left' | 'center' | 'right';
  indent?: Pt;
  borders?: TableBorders;
  cellMargins?: CellMargins;
  layout?: 'fixed' | 'autofit';
  look?: TableLook;
  shading?: Shading;
  cellSpacing?: Pt;
  /** Titre et description (texte de remplacement du tableau). */
  caption?: string;
  description?: string;
  /** Tableau flottant (w:tblpPr) conserve en XML. */
  floating?: XmlElement;
  bidi?: boolean;
}

export interface TableRowProps {
  height?: { value: Pt; rule: 'atLeast' | 'exact' | 'auto' };
  /** Ligne d'en-tete repetee sur chaque page. */
  header?: boolean;
  /** Ne pas couper la ligne entre deux pages. */
  cantSplit?: boolean;
  revision?: Revision;
}

export interface TableCellProps {
  width?: Width;
  /** Fusion horizontale : nombre de colonnes de la grille couvertes. */
  gridSpan?: number;
  /** Fusion verticale : debut ou suite. */
  vMerge?: 'restart' | 'continue';
  borders?: TableBorders & { tl2br?: Border; tr2bl?: Border };
  shading?: Shading;
  verticalAlign?: 'top' | 'center' | 'bottom';
  margins?: CellMargins;
  textDirection?: string;
  noWrap?: boolean;
}

export interface TableCell {
  props: TableCellProps;
  blocks: Block[];
}

export interface TableRow {
  props: TableRowProps;
  cells: TableCell[];
}

export interface Table {
  type: 'table';
  styleId?: string;
  props: TableProps;
  /** Largeur des colonnes de la grille. */
  grid: Pt[];
  rows: TableRow[];
}
