// Modele Texte : elements en ligne (texte, images, champs, liens, notes, formes, equations).
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { Block, ContentControlProps, FormatChange, Revision } from './model-blocks.ts';
import type { RunProps } from './model-props.ts';
import type { Style } from './model-styles.ts';
import type { Hex, Pt } from './model.ts';

interface InlineBase {
  /** Insertion / suppression suivie. */
  revision?: Revision;
}

export interface TextRun extends InlineBase {
  type: 'text';
  /** Texte brut. Les traits d'union conditionnels sont U+00AD, insecables U+2011. */
  text: string;
  /** Style de caractere. */
  styleId?: string;
  props: RunProps;
  formatChange?: FormatChange<RunProps>;
}

export interface Break extends InlineBase {
  type: 'break';
  kind: 'line' | 'page' | 'column';
  /** Saut de ligne qui degage les objets flottants. */
  clear?: 'left' | 'right' | 'all';
  props?: RunProps;
}

export interface Tab extends InlineBase {
  type: 'tab';
  props?: RunProps;
}

/** Caractere de police symbole (w:sym). */
export interface SymbolChar extends InlineBase {
  type: 'symbol';
  font: string;
  /** Code hexadecimal (« F0E0 »). */
  char: string;
  props?: RunProps;
}

export type WrapType = 'square' | 'tight' | 'through' | 'topAndBottom' | 'none';

export interface FloatPosition {
  relativeTo: 'margin' | 'page' | 'column' | 'character' | 'paragraph' | 'line' | 'insideMargin'
    | 'outsideMargin' | 'leftMargin' | 'rightMargin' | 'topMargin' | 'bottomMargin';
  /** Alignement (left, center, right, top, bottom, inside, outside) ou decalage en points. */
  align?: string;
  offset?: Pt;
}

/** Ancrage flottant d'une image ou d'une forme. */
export interface Floating {
  horizontal: FloatPosition;
  vertical: FloatPosition;
  wrap: WrapType;
  /** Cote d'habillage (square, tight, through). */
  wrapSide?: 'bothSides' | 'left' | 'right' | 'largest';
  /** Derriere le texte (wrap none + behindDoc) ou devant le texte (wrap none). */
  behindText: boolean;
  /** Distance au texte. */
  distance: { top: Pt; right: Pt; bottom: Pt; left: Pt };
  allowOverlap: boolean;
  lockAnchor?: boolean;
  /** Ordre d'empilement. */
  zIndex: number;
}

export interface ImageInline extends InlineBase {
  type: 'image';
  /** Cle dans Document.media. */
  mediaId: string;
  width: Pt;
  height: Pt;
  /** Texte de remplacement. */
  alt?: string;
  title?: string;
  name?: string;
  /** Image decorative (pas de texte de remplacement attendu). */
  decorative?: boolean;
  /** Recadrage en fractions 0..1 de chaque bord. */
  crop?: { top: number; right: number; bottom: number; left: number };
  /** Rotation en degres. */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Absent = image dans le texte. */
  floating?: Floating;
  /** Lien hypertexte sur l'image. */
  link?: string;
  props?: RunProps;
}

export interface Hyperlink extends InlineBase {
  type: 'hyperlink';
  /** URL externe (http, https, mailto, file...). Les URL javascript:, vbscript:, data: sont refusees. */
  url?: string;
  /** Signet interne. */
  anchor?: string;
  tooltip?: string;
  inlines: Inline[];
}

/** Champ (PAGE, NUMPAGES, DATE, TOC, REF, HYPERLINK...) avec son dernier resultat calcule. */
export interface Field extends InlineBase {
  type: 'field';
  /** Instruction complete (« PAGE \* MERGEFORMAT »). */
  instruction: string;
  /** Code du champ en majuscules (« PAGE »). */
  code: string;
  result: Inline[];
  locked?: boolean;
  /** A recalculer a l'ouverture. */
  dirty?: boolean;
  props?: RunProps;
}

/** Bornes d'un champ qui traverse plusieurs paragraphes (table des matieres, index). */
export interface FieldChar extends InlineBase {
  type: 'fieldChar';
  kind: 'begin' | 'separate' | 'end';
  /** Instruction, portee par la borne « begin ». */
  instruction?: string;
  props?: RunProps;
}

export interface BookmarkStart {
  type: 'bookmarkStart';
  id: number;
  name: string;
}

export interface BookmarkEnd {
  type: 'bookmarkEnd';
  id: number;
}

/** Appel de note dans le texte. */
export interface NoteReference extends InlineBase {
  type: 'footnoteRef' | 'endnoteRef';
  /** Cle dans Document.footnotes / endnotes. */
  noteId: number;
  /** Marque personnalisee (au lieu du numero automatique). */
  customMark?: string;
  props?: RunProps;
}

/** Numero de la note, en tete du texte de la note elle-meme. */
export interface NoteMark {
  type: 'noteMark';
  kind: 'footnote' | 'endnote';
  props?: RunProps;
}

export interface CommentAnchor {
  type: 'commentStart' | 'commentEnd' | 'commentRef';
  /** Cle dans Document.comments. */
  commentId: number;
}

export interface ShapeInline extends InlineBase {
  type: 'shape';
  /** Geometrie predefinie DrawingML (« rect », « ellipse », « roundRect »...). */
  geometry: string;
  width: Pt;
  height: Pt;
  fill?: Hex;
  line?: { color: Hex; width: Pt };
  /** Contenu de la zone de texte. */
  text?: Block[];
  floating?: Floating;
  name?: string;
  alt?: string;
}

/** Equation (OMML conserve). */
export interface Equation {
  type: 'equation';
  /** m:oMath ou m:oMathPara. */
  omml: XmlElement;
  /** Equation affichee (bloc) plutot qu'en ligne. */
  display: boolean;
  /** Forme lineaire lisible (« x=(-b±√(b^2-4ac))/2a »). */
  text: string;
}

/** Controle de contenu en ligne. */
export interface InlineContentControl {
  type: 'inlineControl';
  props: ContentControlProps;
  inlines: Inline[];
}

/** Partie de paquet conservee telle quelle, avec ses propres relations (identifiants d'origine). */
export interface StoredPart {
  path: string;
  contentType: string;
  bytes: Uint8Array;
  rels: StoredRel[];
}

export interface StoredRel {
  id: string;
  type: string;
  /** URL si externe, sinon chemin de la partie cible. */
  target: string;
  external: boolean;
  part?: StoredPart;
}

/** Element en ligne non modelise conserve tel quel (avec les relations qu'il reference). */
export interface RawInline {
  type: 'raw';
  xml: XmlElement;
  rels?: Record<string, StoredRel>;
}

export type Inline =
  | TextRun | Break | Tab | SymbolChar | ImageInline | Hyperlink | Field | FieldChar
  | BookmarkStart | BookmarkEnd | NoteReference | NoteMark | CommentAnchor | ShapeInline
  | Equation | InlineContentControl | RawInline;
