// Types du moteur de geometrie DrawingML.

/**
 * Definition compacte d'une forme predefinie, calquee sur presetShapeDefinitions.xml :
 * - av / gd : « nom formule » (ex. « adj val 25000 », « y1 *\/ ss a 200000 ») ;
 * - ah : « xy gdRefX minX maxX gdRefY minY maxY posX posY » ou
 *        « polar gdRefR minR maxR gdRefAng minAng maxAng posX posY » (« _ » = absent) ;
 * - cxn : « angle x y » ; rect : « l t r b » ;
 * - path : un tableau par chemin ; premier element optionnel « w=.. h=.. fill=.. stroke=0 »,
 *   puis commandes « M x y », « L x y », « C x y x y x y », « Q x y x y », « A wR hR stAng swAng », « Z ».
 */
export interface PresetDef {
  readonly av?: readonly string[];
  readonly gd?: readonly string[];
  readonly ah?: readonly string[];
  readonly cxn?: readonly string[];
  readonly rect?: string;
  readonly path: ReadonlyArray<readonly string[]>;
}

export interface GeometryPathOut {
  d: string;
  fill: 'none' | 'norm' | 'lighten' | 'lightenLess' | 'darken' | 'darkenLess';
  stroke: boolean;
}

/** Position d'une poignee jaune en coordonnees locales de la forme (0..w, 0..h). */
export interface GeometryHandle {
  x: number;
  y: number;
}

export interface GeometryResult {
  /** `d` en coordonnees locales (points), origine en haut a gauche de la forme. */
  paths: GeometryPathOut[];
  textRect: { x: number; y: number; width: number; height: number };
  /** Angle en degres. */
  connectionSites: Array<{ x: number; y: number; angle: number }>;
  handles: GeometryHandle[];
}
