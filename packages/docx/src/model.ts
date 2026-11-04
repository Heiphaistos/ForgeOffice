// Modele de document Texte : CONTRAT partage entre les lecteurs/ecrivains de formats (.docx, .rtf, .odt,
// .html, .md, .txt, .doc) et le futur editeur Texte.
//
// Principes :
// - Toutes les longueurs sont en points (pt, 1/72 de pouce). Les conversions OOXML (twips, demi-points,
//   huitiemes de point, EMU) sont faites par les lecteurs/ecrivains (voir units.ts).
// - Les couleurs sont des chaines hexadecimales « RRGGBB » en majuscules, ou « auto ».
// - Les proprietes absentes (undefined) sont heritees : style de paragraphe -> style lie / basedOn ->
//   valeurs par defaut du document (docDefaults). Voir resolve.ts pour le calcul des valeurs effectives.
// - Ce que le modele ne represente pas finement est conserve tel quel (XML brut, parties inconnues) pour
//   que l'aller-retour lecture -> ecriture ne perde rien.

export * from './model-props.ts';
export * from './model-styles.ts';
export * from './model-section.ts';
export * from './model-table.ts';
export * from './model-blocks.ts';
export * from './model-inline.ts';
import type { Block } from './model-blocks.ts';
import type { StoredRel } from './model-inline.ts';
import type { DocumentProperties, DocumentSettings, Theme } from './model-props.ts';
import type { HeaderFooter, Section } from './model-section.ts';
import type { Numbering, StyleSheet } from './model-styles.ts';

/** Longueur en points typographiques. */
export type Pt = number;

/** « RRGGBB » ou « auto ». */
export type Hex = string;

// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// Notes, commentaires, medias, document
// ---------------------------------------------------------------------------------------------------

export interface Note {
  id: number;
  /** Separateurs Word (notes -1 / 0) : conserves mais non affiches comme notes. */
  special?: 'separator' | 'continuationSeparator' | 'continuationNotice';
  blocks: Block[];
}

export interface Comment {
  id: number;
  author: string;
  initials?: string;
  date?: string;
  blocks: Block[];
  /** Reponse a ce commentaire (fil de discussion). */
  parentId?: number;
  /** Commentaire resolu. */
  done?: boolean;
}

export interface MediaItem {
  id: string;
  /** Nom de fichier suggere (« image1.png »). */
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

/** Relation non modelisee (customXml, macros VBA, glossaire...) conservee pour l'aller-retour. */
export interface PreservedRel {
  /** Depuis le paquet (_rels/.rels) ou depuis le document principal. */
  source: 'package' | 'document';
  rel: StoredRel;
}

/** Variante de fichier Word. */
export type WordFileKind = 'docx' | 'docm' | 'dotx' | 'dotm';

export interface WordDocument {
  kind: WordFileKind;
  properties: DocumentProperties;
  theme: Theme;
  settings: DocumentSettings;
  styles: StyleSheet;
  numbering: Numbering;
  /** Corps du document. Les fins de section sont marquees par Paragraph.sectionBreak. */
  body: Block[];
  /** Proprietes de la derniere section (w:body/w:sectPr). */
  finalSection: Section;
  headersFooters: Record<string, HeaderFooter>;
  footnotes: Note[];
  endnotes: Note[];
  comments: Comment[];
  media: Record<string, MediaItem>;
  /** Polices declarees (w:fonts) : nom -> famille generique. */
  fonts: Record<string, { family?: string; altName?: string }>;
  preserved: PreservedRel[];
}

/** Avertissement de lecture (fichier abime, element ignore, lien refuse...). */
export interface ReadWarning {
  code: string;
  message: string;
}

export interface ReadResult {
  document: WordDocument;
  warnings: ReadWarning[];
}
