// Tableaux croises dynamiques persistants : cache de donnees (PivotCache) et definition du tableau (PivotTable).
// Les cellules resultat restent dans la feuille ; ce modele conserve la source, les champs et leur disposition
// pour qu'Excel (et le Tableur) reconnaissent et rafraichissent le tableau.
import type { XmlElement } from '@forgeoffice/opc';
import type { CellError, CellRange } from './model.ts';

/** Date d'un cache (ISO 8601 sans fuseau, ex. « 2020-01-15T00:00:00 »). */
export interface PivotDate {
  date: string;
}

/** Valeur d'un enregistrement du cache ; null = cellule vide. */
export type PivotValue = string | number | boolean | CellError | PivotDate | null;

export interface PivotCacheField {
  name: string;
  numFmtId?: number;
  /** Champ calcule (formule sans « = ») : n'a pas de colonne dans les enregistrements. */
  formula?: string;
  /** Attributs non interpretes de « cacheField », conserves tels quels. */
  attrs?: Record<string, string>;
}

/** Source du cache : plage d'une feuille ou nom (tableau / nom defini). */
export interface PivotSource {
  sheet?: string;
  ref?: CellRange;
  /** Nom de tableau ou de plage nommee (a la place de `sheet`/`ref`). */
  name?: string;
}

export interface PivotCache {
  /** Identifiant (attribut « cacheId » du classeur) ; unique dans le classeur. */
  id: number;
  source: PivotSource;
  fields: PivotCacheField[];
  /** Une ligne par enregistrement source ; une valeur par champ non calcule. */
  records: PivotValue[][];
  /** Recalculer le cache a l'ouverture (Excel relit la source). */
  refreshOnLoad?: boolean;
  /** Attributs non interpretes de « pivotCacheDefinition » (refreshedBy, refreshedDate...). */
  attrs?: Record<string, string>;
}

export type PivotSummary =
  | 'sum' | 'count' | 'average' | 'max' | 'min' | 'product' | 'countNums' | 'stdDev' | 'stdDevp' | 'var' | 'varp';

export type PivotAxis = 'row' | 'col' | 'page';

export interface PivotItemDef {
  value: PivotValue;
  hidden?: boolean;
  /** Libelle renomme par l'utilisateur. */
  caption?: string;
}

export interface PivotFieldDef {
  axis?: PivotAxis;
  /** Elements dans l'ordre d'affichage ; absent = tous les elements du cache, tries par ordre croissant. */
  items?: PivotItemDef[];
  /** Sous-totaux automatiques (vrai par defaut). */
  defaultSubtotal?: boolean;
  /** Attributs non interpretes de « pivotField » (tri, sous-totaux personnalises...). */
  attrs?: Record<string, string>;
}

export interface PivotDataField {
  name: string;
  /** Index du champ du cache. */
  field: number;
  summary?: PivotSummary;
  /** Format de nombre (code) ; ecrit dans les styles du classeur. */
  numFmt?: string;
  numFmtId?: number;
  showDataAs?: string;
  baseField?: number;
  baseItem?: number;
}

export interface PivotPageField {
  field: number;
  /** Element unique selectionne (absent = « (Tous) »). */
  selected?: PivotValue;
}

/** Ligne ou colonne de la disposition (rowItems / colItems). */
export interface PivotLineItem {
  type?: string;
  /** Nombre de niveaux repetes depuis l'element precedent. */
  repeat?: number;
  /** Index du champ de donnees (attribut « i »). */
  dataIndex?: number;
  /** Positions dans la liste d'elements de chaque champ de l'axe. */
  x: number[];
}

export interface PivotTable {
  name: string;
  /** Cache source (`PivotCache.id`). */
  cacheId: number;
  /**
   * Zone occupee par le tableau dans la feuille (sans les filtres de rapport). A l'ecriture, si `rowItems` ou
   * `colItems` est absent, seule la cellule en haut a gauche compte : l'etendue est recalculee depuis la disposition.
   */
  location: CellRange;
  /** Un element par champ du cache. */
  fields: PivotFieldDef[];
  /** Index des champs en lignes et en colonnes ; -2 = champ « Valeurs ». */
  rowFields: number[];
  colFields: number[];
  pageFields: PivotPageField[];
  dataFields: PivotDataField[];
  rowItems?: PivotLineItem[];
  colItems?: PivotLineItem[];
  /** Style de tableau croise (ex. « PivotStyleLight16 »). */
  style?: {
    name?: string;
    showRowHeaders?: boolean;
    showColHeaders?: boolean;
    showRowStripes?: boolean;
    showColStripes?: boolean;
    showLastColumn?: boolean;
  };
  /** Legende du champ Valeurs (« Valeurs »). */
  dataCaption?: string;
  rowGrandTotals?: boolean;
  colGrandTotals?: boolean;
  /** Attributs de « location » (firstHeaderRow, firstDataRow, firstDataCol, rowPageCount, colPageCount). */
  locationAttrs?: Record<string, string>;
  /** Attributs non interpretes de « pivotTableDefinition ». */
  attrs?: Record<string, string>;
  /** Elements conserves tels quels (formats, conditionalFormats, chartFormats, extLst...). */
  raw?: XmlElement[];
}

/** Cle d'egalite d'une valeur de cache (distingue 1, "1", vrai et vide). */
export function pivotValueKey(v: PivotValue): string {
  if (v === null) return 'm';
  if (typeof v === 'number') return `n${v}`;
  if (typeof v === 'string') return `s${v}`;
  if (typeof v === 'boolean') return v ? 'b1' : 'b0';
  if ('error' in v) return `e${v.error}`;
  return `d${v.date}`;
}

/** Ordre d'affichage par defaut des elements : nombres, texte (alphabetique), booleens, erreurs, vide. */
export function comparePivotValues(a: PivotValue, b: PivotValue): number {
  const rank = (v: PivotValue): number =>
    v === null ? 5 : typeof v === 'number' ? 0 : typeof v === 'object' && 'date' in v ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 3;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'fr', { sensitivity: 'accent' });
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && 'date' in a && 'date' in b) return a.date.localeCompare(b.date);
  return 0;
}
