// Modele Texte : proprietes du document, theme, reglages, proprietes de caracteres et de paragraphes.
// Les types sont re-exportes par model.ts : importer depuis './model.ts'.
import type { XmlElement } from '@forgeoffice/opc';
import type { Hex, Pt } from './model.ts';

export interface DocumentProperties {
  title?: string;
  subject?: string;
  /** Auteur. */
  creator?: string;
  keywords?: string;
  description?: string;
  category?: string;
  contentStatus?: string;
  lastModifiedBy?: string;
  revision?: number;
  /** Dates ISO 8601. */
  created?: string;
  modified?: string;
  lastPrinted?: string;
  language?: string;
  company?: string;
  manager?: string;
  /** Application d'origine (« ForgeOffice Texte », « Microsoft Office Word »...). */
  application?: string;
  template?: string;
  /** Statistiques enregistrees par l'application d'origine (docProps/app.xml). */
  pages?: number;
  words?: number;
  characters?: number;
  /** Proprietes personnalisees (docProps/custom.xml), valeurs converties en texte. */
  custom: Record<string, string>;
}

export type ThemeColorName =
  | 'dk1' | 'lt1' | 'dk2' | 'lt2'
  | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6'
  | 'hlink' | 'folHlink';

/** Noms de couleurs de theme acceptes dans les proprietes de texte (w:themeColor). */
export type ThemeColorRef =
  | ThemeColorName
  | 'text1' | 'text2' | 'background1' | 'background2'
  | 'hyperlink' | 'followedHyperlink' | 'dark1' | 'dark2' | 'light1' | 'light2';

export interface Theme {
  name: string;
  /** Police des titres (« Aptos Display »). */
  majorFont: string;
  /** Police du corps (« Aptos »). */
  minorFont: string;
  majorEastAsia?: string;
  minorEastAsia?: string;
  colors: Record<ThemeColorName, Hex>;
  /** XML d'origine du theme, reecrit tel quel pour la fidelite (null = theme genere). */
  rawXml: string | null;
}

export interface DocumentSettings {
  defaultTabStop: Pt;
  evenAndOddHeaders: boolean;
  mirrorMargins: boolean;
  /** Suivi des modifications actif. */
  trackRevisions: boolean;
  autoHyphenation: boolean;
  /** Pourcentage de zoom enregistre. */
  zoom: number;
  /** Demande la mise a jour des champs a l'ouverture (table des matieres...). */
  updateFields: boolean;
  /** Mode de compatibilite Word (15 = Word 2013 et suivants). */
  compatibilityMode: number;
  /** Langue par defaut du texte (« fr-FR »). */
  language?: string;
  /** Protection du document (lecture seule, commentaires...) conservee telle quelle. */
  protection?: { kind: string; enforced: boolean; /** Empreinte du mot de passe (absent = sans mot de passe). */ password?: PasswordHash };
  /** Numerotation des notes de bas de page / de fin (w:footnotePr / w:endnotePr du fichier de reglages). */
  footnoteNumbering?: NoteNumbering;
  endnoteNumbering?: NoteNumbering;
}

/** Empreinte salee d'un mot de passe (SHA-512, base64). */
export interface PasswordHash {
  hash: string;
  salt: string;
  spinCount: number;
}

export interface NoteNumbering {
  /** Format du numero (w:numFmt) : decimal, lowerRoman, upperLetter... */
  format?: string;
  /** Premier numero (w:numStart). */
  start?: number;
  /** Redemarrage (w:numRestart) : continuous, eachSect, eachPage. */
  restart?: 'continuous' | 'eachSect' | 'eachPage';
  /** Emplacement (w:pos) : pageBottom, beneathText, sectEnd, docEnd. */
  position?: string;
}

// ---------------------------------------------------------------------------------------------------
// Proprietes de caracteres et de paragraphes
// ---------------------------------------------------------------------------------------------------

export interface Color {
  /** « RRGGBB » ou « auto ». */
  rgb: Hex;
  theme?: ThemeColorRef;
  /** Eclaircissement / assombrissement 0..255 (w:themeTint / w:themeShade). */
  tint?: number;
  shade?: number;
}

export type UnderlineType =
  | 'single' | 'words' | 'double' | 'thick' | 'dotted' | 'dottedHeavy' | 'dash' | 'dashedHeavy'
  | 'dashLong' | 'dashLongHeavy' | 'dotDash' | 'dashDotHeavy' | 'dotDotDash' | 'dashDotDotHeavy'
  | 'wave' | 'wavyHeavy' | 'wavyDouble' | 'none';

/** Couleurs de surlignage Word. */
export type HighlightColor =
  | 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen'
  | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'darkGray' | 'lightGray' | 'black' | 'white' | 'none';

export interface Shading {
  /** Couleur de fond « RRGGBB » ou « auto ». */
  fill: Hex;
  /** Motif (« clear », « solid », « pct10 »...). */
  pattern?: string;
  /** Couleur du motif. */
  color?: Hex;
  themeFill?: ThemeColorRef;
}

export type BorderStyle =
  | 'none' | 'single' | 'thick' | 'double' | 'dotted' | 'dashed' | 'dotDash' | 'dotDotDash' | 'triple'
  | 'wave' | 'doubleWave' | 'threeDEmboss' | 'threeDEngrave' | 'outset' | 'inset'
  | 'thinThickSmallGap' | 'thickThinSmallGap' | 'thinThickMediumGap' | 'thickThinMediumGap';

export interface Border {
  style: BorderStyle;
  /** Epaisseur du trait. */
  width: Pt;
  color: Hex;
  /** Distance au texte. */
  space: Pt;
  themeColor?: ThemeColorRef;
}

export interface RunProps {
  bold?: boolean;
  italic?: boolean;
  /** Gras / italique des ecritures complexes (arabe, hebreu...). */
  boldCs?: boolean;
  italicCs?: boolean;
  underline?: UnderlineType;
  underlineColor?: Hex;
  strike?: boolean;
  doubleStrike?: boolean;
  /** Tout en majuscules (affichage). */
  caps?: boolean;
  smallCaps?: boolean;
  /** Police latine (ascii / hAnsi). */
  font?: string;
  fontEastAsia?: string;
  fontComplex?: string;
  /** Police du theme (titres = major, corps = minor), prioritaire sur `font` si definie. */
  fontTheme?: 'major' | 'minor';
  /** Taille en points (11, 10.5...). */
  size?: Pt;
  sizeComplex?: Pt;
  color?: Color;
  highlight?: HighlightColor;
  shading?: Shading;
  vertAlign?: 'baseline' | 'superscript' | 'subscript';
  /** Espacement des caracteres (positif = etendu, negatif = condense). */
  spacing?: Pt;
  /** Echelle horizontale en pourcentage (100 = normale). */
  scale?: number;
  /** Crenage a partir de cette taille. */
  kerning?: Pt;
  /** Position verticale (positif = eleve). */
  position?: Pt;
  /** Langue BCP 47 (« fr-FR »). */
  lang?: string;
  langEastAsia?: string;
  langComplex?: string;
  /** Texte masque. */
  hidden?: boolean;
  emboss?: boolean;
  imprint?: boolean;
  outline?: boolean;
  shadow?: boolean;
  rtl?: boolean;
  /** Ne pas verifier l'orthographe. */
  noProof?: boolean;
  border?: Border;
  /** Effets de texte non modelises (w14:glow...) conserves en XML. */
  extra?: XmlElement[];
}

export type Alignment = 'left' | 'center' | 'right' | 'justify' | 'distribute';

export interface TabStop {
  position: Pt;
  align: 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear';
  leader?: 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}

export interface LineSpacing {
  /** auto : `value` est un multiple (1, 1.08, 1.5, 2) ; exact / atLeast : `value` en points. */
  rule: 'auto' | 'exact' | 'atLeast';
  value: number;
}

export interface ParagraphBorders {
  top?: Border;
  bottom?: Border;
  left?: Border;
  right?: Border;
  /** Entre paragraphes ayant les memes bordures. */
  between?: Border;
  bar?: Border;
}

export interface ParagraphProps {
  alignment?: Alignment;
  indentLeft?: Pt;
  indentRight?: Pt;
  /** Retrait de premiere ligne : positif = alinea, negatif = suspendu. */
  indentFirstLine?: Pt;
  spacingBefore?: Pt;
  spacingAfter?: Pt;
  beforeAutospacing?: boolean;
  afterAutospacing?: boolean;
  lineSpacing?: LineSpacing;
  /** Ne pas ajouter d'espace entre paragraphes du meme style. */
  contextualSpacing?: boolean;
  tabs?: TabStop[];
  borders?: ParagraphBorders;
  shading?: Shading;
  /** Liste : instance de numerotation et niveau 0..8. numId 0 = retire la liste heritee. */
  numbering?: { numId: number; level: number };
  /** Niveau hierarchique 0..8 (Titre 1 = 0) ; 9 = corps de texte. */
  outlineLevel?: number;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  /** Eviter veuves et orphelines. */
  widowControl?: boolean;
  suppressLineNumbers?: boolean;
  suppressAutoHyphens?: boolean;
  /** Paragraphe de droite a gauche. */
  bidi?: boolean;
  textDirection?: string;
  /** Lettrine (drop cap) : nombre de lignes et type. */
  dropCap?: { kind: 'drop' | 'margin'; lines: number };
  /** Proprietes non modelisees (cadre w:framePr...) conservees en XML. */
  extra?: XmlElement[];
}
