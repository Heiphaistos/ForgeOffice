// Types DrawingML partages (couleurs, remplissages, contours, effets, texte, geometrie).
// Unites : points (pt), degres, pourcentages (0..100). Seuls les modificateurs de couleur gardent
// la valeur brute OOXML (100000 = 100 %) pour un aller-retour exact.
import type { XmlElement } from '@forgeoffice/opc';

export type SchemeColorName =
  | 'dk1' | 'lt1' | 'dk2' | 'lt2'
  | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6'
  | 'hlink' | 'folHlink'
  | 'bg1' | 'tx1' | 'bg2' | 'tx2'
  | 'phClr';

/** Modificateur de couleur OOXML : lumMod, lumOff, alpha, tint, shade, satMod, hueOff, comp, inv, gray... */
export interface ColorMod {
  name: string;
  val?: number;
}

export type Color =
  | { type: 'rgb'; value: string; mods?: ColorMod[] }
  | { type: 'scheme'; value: SchemeColorName; mods?: ColorMod[] }
  | { type: 'system'; value: string; last?: string; mods?: ColorMod[] }
  | { type: 'preset'; value: string; mods?: ColorMod[] };

export interface GradientStop {
  /** Position 0..100 (%). */
  position: number;
  color: Color;
}

/** Marges (pt) ou recadrage (%) depuis chaque bord. */
export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Fill =
  | { type: 'none' }
  | { type: 'solid'; color: Color }
  | {
      type: 'gradient';
      stops: GradientStop[];
      /** linear = degrade lineaire ; circle/rect/shape = degrade de chemin. */
      kind: 'linear' | 'circle' | 'rect' | 'shape';
      angle?: number;
      scaled?: boolean;
      rotateWithShape?: boolean;
      /** Rectangle de remplissage d'un degrade de chemin (% depuis chaque bord). */
      focus?: Insets;
      tileFlip?: 'none' | 'x' | 'y' | 'xy';
    }
  | {
      type: 'image';
      mediaId: string;
      mode: 'stretch' | 'tile';
      crop?: Insets;
      stretch?: Insets;
      tile?: { tx: number; ty: number; sx: number; sy: number; flip?: string; align?: string };
      alpha?: number;
      rotateWithShape?: boolean;
    }
  | { type: 'pattern'; preset: string; foreground: Color; background: Color }
  | { type: 'group' };

export type LineEndType = 'none' | 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow';

export interface LineEnd {
  type: LineEndType;
  width?: 'sm' | 'med' | 'lg';
  length?: 'sm' | 'med' | 'lg';
}

export interface Line {
  fill?: Fill;
  /** Epaisseur en points. */
  width?: number;
  /** Tirets predefinis : solid, dot, dash, lgDash, dashDot, lgDashDot, lgDashDotDot, sysDash, sysDot, sysDashDot, sysDashDotDot. */
  dash?: string;
  /** Tirets personnalises (longueurs en % de l'epaisseur). */
  customDash?: Array<{ dash: number; space: number }>;
  cap?: 'flat' | 'rnd' | 'sq';
  join?: 'round' | 'bevel' | 'miter';
  compound?: 'sng' | 'dbl' | 'thickThin' | 'thinThick' | 'tri';
  align?: 'ctr' | 'in';
  head?: LineEnd;
  tail?: LineEnd;
}

export interface Shadow {
  color: Color;
  /** Flou et distance en points ; direction en degres. */
  blur: number;
  distance: number;
  direction: number;
  /** Echelle (%) et inclinaison (degres), ombres exterieures seulement. */
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
  align?: string;
  rotateWithShape?: boolean;
}

export interface Reflection {
  blur: number;
  startAlpha: number;
  startPosition: number;
  endAlpha: number;
  endPosition: number;
  distance: number;
  direction: number;
  fadeDirection: number;
  scaleX: number;
  scaleY: number;
  skewX?: number;
  skewY?: number;
  align?: string;
  rotateWithShape?: boolean;
}

export interface Effects {
  outerShadow?: Shadow;
  innerShadow?: Shadow;
  /** Ombre predefinie (shdw1..shdw20). */
  presetShadow?: { preset: string; color: Color; distance: number; direction: number };
  glow?: { color: Color; radius: number };
  reflection?: Reflection;
  softEdge?: number;
  blur?: { radius: number; grow?: boolean };
  /** 3D (scene3d, sp3d) conserve tel quel. */
  extra?: XmlElement[];
}

export interface Hyperlink {
  /** URL externe (http, https, mailto, fichier). Les liens « javascript: » sont refuses a la lecture. */
  url?: string;
  /** Saut vers une diapositive (identifiant de diapositive). */
  slideId?: number;
  /** Action PowerPoint (ppaction://hlinkshowjump?jump=nextslide...). */
  action?: string;
  tooltip?: string;
  highlightClick?: boolean;
}

export type Spacing = { type: 'pct'; value: number } | { type: 'pts'; value: number };

export type Bullet =
  | { type: 'none' }
  | { type: 'char'; char: string }
  /** Numerotation automatique : arabicPeriod, alphaLcParenR, romanUcPeriod... */
  | { type: 'auto'; scheme: string; startAt?: number }
  | { type: 'image'; mediaId: string };

export interface RunProps {
  font?: string;
  eastAsianFont?: string;
  complexFont?: string;
  symbolFont?: string;
  /** Taille en points. */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  /** none, sng, dbl, heavy, dotted, dottedHeavy, dash, dashHeavy, dashLong, dotDash, dotDotDash, wavy, wavyDbl, words... */
  underline?: string;
  underlineColor?: Color;
  strike?: 'noStrike' | 'sngStrike' | 'dblStrike';
  /** Couleur unie du texte. */
  color?: Color;
  /** Remplissage non uni du texte (degrade, motif, aucun) : prioritaire sur `color`. */
  textFill?: Fill;
  highlight?: Color;
  /** Decalage de ligne de base en % (30 = exposant, -25 = indice). */
  baseline?: number;
  /** Espacement des caracteres en points. */
  spacing?: number;
  caps?: 'none' | 'small' | 'all';
  /** Crenage a partir de cette taille (pt). */
  kern?: number;
  lang?: string;
  altLang?: string;
  outline?: Line;
  effects?: Effects;
  link?: Hyperlink;
  hoverLink?: Hyperlink;
  noProof?: boolean;
  rtl?: boolean;
}

export interface TabStop {
  position: number;
  align: 'l' | 'ctr' | 'r' | 'dec';
}

export interface ParagraphProps {
  align?: 'l' | 'ctr' | 'r' | 'just' | 'justLow' | 'dist' | 'thaiDist';
  /** Niveau de plan 0..8. */
  level?: number;
  marginLeft?: number;
  marginRight?: number;
  /** Retrait de premiere ligne (negatif = suspendu). */
  indent?: number;
  lineSpacing?: Spacing;
  spaceBefore?: Spacing;
  spaceAfter?: Spacing;
  bullet?: Bullet;
  /** Couleur de puce ; « text » = suit le texte. */
  bulletColor?: Color | 'text';
  bulletSize?: { type: 'text' } | { type: 'pct'; value: number } | { type: 'pts'; value: number };
  /** Police de puce ; « text » = suit le texte. */
  bulletFont?: string;
  rtl?: boolean;
  tabs?: TabStop[];
  defaultTabSize?: number;
  fontAlign?: 'auto' | 't' | 'ctr' | 'base' | 'b';
  eastAsianLineBreak?: boolean;
  latinLineBreak?: boolean;
  hangingPunctuation?: boolean;
  defaultRun?: RunProps;
}

export type Run =
  | { type: 'text'; text: string; props: RunProps }
  | { type: 'break'; props: RunProps }
  /** Champ : slidenum, datetime, datetime1..13... ; `text` est la derniere valeur affichee. */
  | { type: 'field'; fieldType: string; id: string; text: string; props: RunProps };

export interface Paragraph {
  props: ParagraphProps;
  runs: Run[];
  endProps?: RunProps;
}

/** Styles par niveau : `def` (defPPr) puis niveaux 0..8 (lvl1pPr..lvl9pPr). */
export interface ListStyle {
  def?: ParagraphProps;
  levels: Partial<Record<number, ParagraphProps>>;
}

export type VerticalText = 'horz' | 'vert' | 'vert270' | 'wordArtVert' | 'eaVert' | 'mongolianVert' | 'wordArtVertRtl';

export type Autofit =
  | { type: 'none' }
  /** Reduire le texte : echelle de police et reduction d'interligne en %. */
  | { type: 'normal'; fontScale?: number; lineSpacingReduction?: number }
  /** Ajuster la forme au texte. */
  | { type: 'shape' };

export interface BodyProps {
  insets?: Partial<Insets>;
  anchor?: 't' | 'ctr' | 'b' | 'just' | 'dist';
  anchorCenter?: boolean;
  wrap?: boolean;
  columns?: number;
  columnSpacing?: number;
  rtlColumns?: boolean;
  autofit?: Autofit;
  vertical?: VerticalText;
  rotation?: number;
  upright?: boolean;
  horzOverflow?: 'overflow' | 'clip';
  vertOverflow?: 'overflow' | 'ellipsis' | 'clip';
  /** Texte WordArt deforme (textArchUp, textWave1...). */
  warp?: { preset: string; adjust?: Record<string, number> };
  /** scene3d, sp3d, flatTx conserves. */
  extra?: XmlElement[];
}

export interface TextBody {
  props: BodyProps;
  listStyle?: ListStyle;
  paragraphs: Paragraph[];
}

/** Coordonnee de chemin : nombre (unites du chemin) ou nom de guide. */
export type PathValue = number | string;

export interface PathPoint {
  x: PathValue;
  y: PathValue;
}

export type PathCommand =
  | { cmd: 'moveTo'; pt: PathPoint }
  | { cmd: 'lineTo'; pt: PathPoint }
  | { cmd: 'cubicBezTo'; pts: [PathPoint, PathPoint, PathPoint] }
  | { cmd: 'quadBezTo'; pts: [PathPoint, PathPoint] }
  | { cmd: 'arcTo'; wR: PathValue; hR: PathValue; stAng: PathValue; swAng: PathValue }
  | { cmd: 'close' };

export interface GeometryPath {
  width?: number;
  height?: number;
  fill?: 'none' | 'norm' | 'lighten' | 'lightenLess' | 'darken' | 'darkenLess';
  stroke?: boolean;
  extrusionOk?: boolean;
  commands: PathCommand[];
}

export interface GeometryGuide {
  name: string;
  formula: string;
}

export type Geometry =
  /** Forme predefinie (rect, roundRect, ellipse, triangle, rightArrow, star5...) ; `adjust` = valeurs brutes des poignees (adj, adj1...). */
  | { type: 'preset'; preset: string; adjust?: Record<string, number> }
  | {
      type: 'custom';
      paths: GeometryPath[];
      guides?: GeometryGuide[];
      adjust?: GeometryGuide[];
      connectionSites?: Array<{ angle: PathValue; pos: PathPoint }>;
      textRect?: { l: PathValue; t: PathValue; r: PathValue; b: PathValue };
    };

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation en degres (sens horaire). */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

/** Reference de style de theme (p:style) : index dans la liste du theme + couleur de remplacement de phClr. */
export interface StyleRef {
  index: number;
  color?: Color;
}

export interface ShapeStyle {
  line?: StyleRef;
  fill?: StyleRef;
  effect?: StyleRef;
  font?: { index: 'major' | 'minor' | 'none'; color?: Color };
}
