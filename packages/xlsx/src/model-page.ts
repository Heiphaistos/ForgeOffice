// Contrat du Tableur (suite) : liens, notes, commentaires, mise en page et protection de feuille.
// Re-exporte par model.ts : importer depuis './model.ts'.
import type { RichRun } from './model-styles.ts';
import type { CellAddress, CellRange, PasswordHash } from './model.ts';

// ---------------------------------------------------------------- Liens, notes, commentaires

export interface Hyperlink {
  ref: CellRange;
  /** URL externe (http, https, mailto, fichier). Jamais « javascript: » (refuse a la lecture). */
  target?: string;
  /** Destination interne (« Feuil2!A1 », nom defini). */
  location?: string;
  tooltip?: string;
  display?: string;
}

/** Note (commentaire historique, bulle jaune). */
export interface Note {
  ref: CellAddress;
  author: string;
  text: string;
  rich?: RichRun[];
  /** Note toujours affichee. */
  visible?: boolean;
  /** Taille de la bulle en pixels. */
  width?: number;
  height?: number;
}

export interface ThreadedCommentReply {
  id: string;
  personId: string;
  text: string;
  /** Date ISO 8601. */
  date?: string;
}

/** Commentaire moderne (fil de discussion Microsoft 365). */
export interface ThreadedComment {
  id: string;
  ref: CellAddress;
  personId: string;
  text: string;
  date?: string;
  done?: boolean;
  replies: ThreadedCommentReply[];
  /** Personnes mentionnees (identifiants). */
  mentions?: string[];
}


// ---------------------------------------------------------------- Mise en page

export interface PageMargins {
  /** Pouces. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  header: number;
  footer: number;
}

export interface HeaderFooter {
  /** Codes Excel (&L, &C, &R, &P, &N, &D, &T, &F, &A...). */
  oddHeader?: string;
  oddFooter?: string;
  evenHeader?: string;
  evenFooter?: string;
  firstHeader?: string;
  firstFooter?: string;
  differentOddEven?: boolean;
  differentFirst?: boolean;
  scaleWithDoc?: boolean;
  alignWithMargins?: boolean;
}

export interface PageSetup {
  /** Zone d'impression (enregistree dans le nom defini « _xlnm.Print_Area »). */
  printArea?: CellRange[];
  /** Lignes / colonnes a repeter (« _xlnm.Print_Titles »). */
  printTitleRows?: { first: number; last: number };
  printTitleCols?: { first: number; last: number };
  margins: PageMargins;
  orientation?: 'portrait' | 'landscape';
  /** Code de papier Excel (9 = A4, 1 = Lettre). */
  paperSize?: number;
  /** Echelle en % (10..400). */
  scale?: number;
  /** Ajuster a N pages en largeur / hauteur (0 = automatique) ; actif si `fitToPage`. */
  fitToPage?: boolean;
  fitToWidth?: number;
  fitToHeight?: number;
  firstPageNumber?: number;
  /** Qualite d'impression en ppp (horizontalDpi / verticalDpi). */
  dpi?: number;
  pageOrder?: 'downThenOver' | 'overThenDown';
  blackAndWhite?: boolean;
  draft?: boolean;
  cellComments?: 'none' | 'asDisplayed' | 'atEnd';
  errors?: 'displayed' | 'blank' | 'dash' | 'NA';
  horizontalCentered?: boolean;
  verticalCentered?: boolean;
  printGridLines?: boolean;
  printHeadings?: boolean;
  headerFooter?: HeaderFooter;
  /** Sauts de page manuels : index de la ligne / colonne APRES laquelle couper. */
  rowBreaks: number[];
  colBreaks: number[];
}

// ---------------------------------------------------------------- Protection de feuille

export interface SheetProtection {
  sheet: boolean;
  password?: PasswordHash;
  objects?: boolean;
  scenarios?: boolean;
  /** true = action AUTORISEE malgre la protection (inverse des attributs OOXML). */
  allow: {
    formatCells?: boolean;
    formatColumns?: boolean;
    formatRows?: boolean;
    insertColumns?: boolean;
    insertRows?: boolean;
    insertHyperlinks?: boolean;
    deleteColumns?: boolean;
    deleteRows?: boolean;
    selectLockedCells?: boolean;
    selectUnlockedCells?: boolean;
    sort?: boolean;
    autoFilter?: boolean;
    pivotTables?: boolean;
  };
}

/** Plage modifiable malgre la protection (Revision > Autoriser la modification des plages). */
export interface ProtectedRange {
  name: string;
  ranges: CellRange[];
  password?: PasswordHash;
}
