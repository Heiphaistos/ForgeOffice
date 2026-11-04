// Modele Texte : sections de page, en-tetes et pieds de page.
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { Block } from './model-blocks.ts';
import type { ParagraphBorders } from './model-props.ts';
import type { NumberFormat } from './model-styles.ts';
import type { Pt } from './model.ts';

export interface PageMargins {
  top: Pt;
  right: Pt;
  bottom: Pt;
  left: Pt;
  header: Pt;
  footer: Pt;
  gutter: Pt;
}

export interface Columns {
  count: number;
  /** Espace entre colonnes egales. */
  space: Pt;
  equalWidth: boolean;
  /** Trait vertical entre les colonnes. */
  separator: boolean;
  /** Largeurs explicites quand equalWidth est faux. */
  widths?: { width: Pt; space: Pt }[];
}

/** Identifiants d'en-tetes/pieds (cles de Document.headersFooters) par type de page. */
export interface HeaderFooterRefs {
  default?: string;
  first?: string;
  even?: string;
}

export type SectionBreakType = 'nextPage' | 'continuous' | 'evenPage' | 'oddPage' | 'nextColumn';

export interface Section {
  pageWidth: Pt;
  pageHeight: Pt;
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
  columns: Columns;
  headers: HeaderFooterRefs;
  footers: HeaderFooterRefs;
  /** Premiere page differente. */
  titlePage: boolean;
  /** Type de saut qui commence cette section. */
  breakType: SectionBreakType;
  pageNumbering?: { start?: number; format?: NumberFormat; chapterStyle?: number };
  verticalAlign?: 'top' | 'center' | 'bottom' | 'both';
  lineNumbering?: { countBy: number; start: number; restart: 'newPage' | 'newSection' | 'continuous'; distance?: Pt };
  pageBorders?: ParagraphBorders & { offsetFrom?: 'page' | 'text' };
  /** Grille de document, notes de section... conservees en XML. */
  extra?: XmlElement[];
}

export interface HeaderFooter {
  id: string;
  kind: 'header' | 'footer';
  blocks: Block[];
}
