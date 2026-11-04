// Modele Texte : blocs du corps (paragraphes, controles de contenu, table des matieres, blocs bruts).
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { Inline, StoredRel } from './model-inline.ts';
import type { ParagraphProps, RunProps } from './model-props.ts';
import type { Section } from './model-section.ts';
import type { Table } from './model-table.ts';

/** Suivi des modifications : insertion / suppression / deplacement. */
export interface Revision {
  kind: 'insert' | 'delete' | 'moveFrom' | 'moveTo';
  id: number;
  author: string;
  /** ISO 8601. */
  date?: string;
}

/** Modification de mise en forme suivie : proprietes d'avant. */
export interface FormatChange<P> {
  id: number;
  author: string;
  date?: string;
  previous: P;
}

export interface Paragraph {
  type: 'paragraph';
  styleId?: string;
  props: ParagraphProps;
  /** Proprietes de la marque de paragraphe (pilcrow) : appliquees aux numeros de liste. */
  markProps?: RunProps;
  /** Marque de paragraphe inseree / supprimee (fusion de paragraphes suivie). */
  markRevision?: Revision;
  formatChange?: FormatChange<ParagraphProps>;
  inlines: Inline[];
  /** Fin de section : ce paragraphe termine une section dont voici les proprietes. */
  sectionBreak?: Section;
  /** Identifiant w14:paraId (ancre des commentaires). */
  paraId?: string;
}

export type ContentControlKind =
  | 'richText' | 'plainText' | 'checkbox' | 'dropDown' | 'comboBox' | 'date' | 'picture' | 'group'
  | 'docPart' | 'citation' | 'bibliography' | 'repeatingSection';

export interface ContentControlProps {
  kind: ContentControlKind;
  id?: number;
  tag?: string;
  /** Titre affiche. */
  alias?: string;
  /** Case cochee (checkbox). */
  checked?: boolean;
  /** Elements de liste (dropDown / comboBox). */
  items?: { display: string; value: string }[];
  /** Format d'affichage (date) : « dd/MM/yyyy ». */
  dateFormat?: string;
  /** Galerie de blocs de construction (docPart). */
  docPartGallery?: string;
  /** Verrouillage : contenu / controle. */
  lock?: 'sdtLocked' | 'contentLocked' | 'sdtContentLocked' | 'unlocked';
  /** Le contenu affiche est le texte d'espace reserve. */
  showingPlaceholder?: boolean;
}

/** Controle de contenu de niveau bloc (w:sdt autour de paragraphes / tableaux). */
export interface ContentControl {
  type: 'contentControl';
  props: ContentControlProps;
  blocks: Block[];
}

/** Table des matieres (controle de contenu de type « Table of Contents » ou champ TOC). */
export interface TableOfContents {
  type: 'toc';
  /** Instruction du champ (« TOC \o "1-3" \h \z \u »). */
  instruction: string;
  /** Contenu calcule (paragraphes « TM 1 », « TM 2 »... avec numeros de page). */
  blocks: Block[];
  /** Identifiant du controle de contenu d'origine. */
  id?: number;
}

/** Bloc non modelise (w:customXml, w:altChunk...) conserve tel quel. */
export interface RawBlock {
  type: 'raw';
  xml: XmlElement;
  rels?: Record<string, StoredRel>;
}

export type Block = Paragraph | Table | ContentControl | TableOfContents | RawBlock;
