// Unites des formats de presentation. Le modele travaille en points (pt), degres et pourcentages.

/** EMU (English Metric Unit) par point : 914400 EMU = 1 pouce = 72 pt. */
export const EMU_PER_PT = 12700;
export const EMU_PER_INCH = 914400;
export const EMU_PER_CM = 360000;
/** Unites d'angle OOXML par degre. */
export const ANGLE_UNIT = 60000;

export function emuToPt(emu: number): number {
  return emu / EMU_PER_PT;
}

export function ptToEmu(pt: number): number {
  return Math.round(pt * EMU_PER_PT);
}

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function ptToMm(pt: number): number {
  return (pt / 72) * 25.4;
}

export function inchToPt(inch: number): number {
  return inch * 72;
}

/** Angle OOXML (60000e de degre) vers degres. */
export function angleToDeg(value: number): number {
  return value / ANGLE_UNIT;
}

export function degToAngle(deg: number): number {
  return Math.round(deg * ANGLE_UNIT);
}

/** Pourcentage OOXML (100000 = 100 %) vers pourcentage. */
export function ooPctToPct(value: number): number {
  return value / 1000;
}

export function pctToOoPct(pct: number): number {
  return Math.round(pct * 1000);
}

/** Taille de diapositive en points. `type` reprend l'attribut OOXML (screen16x9, A4...) quand il est connu. */
export interface SlideSize {
  width: number;
  height: number;
  type?: string;
}

export type SlideSizePreset =
  | 'widescreen'
  | 'standard'
  | 'widescreen16x10'
  | 'a4'
  | 'a3'
  | 'a5'
  | 'letter'
  | 'legal'
  | 'tabloid'
  | 'businessCard'
  | 'banner'
  | 'overhead'
  | 'square';

/** Tailles predefinies (orientation par defaut : paysage pour l'ecran, portrait pour le papier). */
export const SLIDE_SIZES: Readonly<Record<SlideSizePreset, SlideSize>> = {
  widescreen: { width: 960, height: 540, type: 'custom' },
  standard: { width: 720, height: 540, type: 'screen4x3' },
  widescreen16x10: { width: 720, height: 450, type: 'screen16x10' },
  a4: { width: mmToPt(210), height: mmToPt(297), type: 'A4' },
  a3: { width: mmToPt(297), height: mmToPt(420), type: 'A3' },
  a5: { width: mmToPt(148), height: mmToPt(210), type: 'custom' },
  letter: { width: 612, height: 792, type: 'letter' },
  legal: { width: 612, height: 1008, type: 'custom' },
  tabloid: { width: 792, height: 1224, type: 'ledger' },
  businessCard: { width: mmToPt(85), height: mmToPt(55), type: 'custom' },
  banner: { width: 576, height: 72, type: 'banner' },
  overhead: { width: 720, height: 540, type: 'overhead' },
  square: { width: 540, height: 540, type: 'custom' },
};

/** Limites OOXML de p:sldSz (1 a 56 pouces). */
export const MIN_SLIDE_PT = 72;
export const MAX_SLIDE_PT = 56 * 72;

export function clampSlideDimension(pt: number): number {
  return Math.min(MAX_SLIDE_PT, Math.max(MIN_SLIDE_PT, pt));
}

export function orientSize(size: SlideSize, orientation: 'portrait' | 'landscape'): SlideSize {
  const landscape = size.width >= size.height;
  if ((orientation === 'landscape') === landscape) return { ...size };
  return { ...size, width: size.height, height: size.width };
}

export function sizeFromPreset(preset: SlideSizePreset, orientation?: 'portrait' | 'landscape'): SlideSize {
  const base = SLIDE_SIZES[preset];
  return orientation ? orientSize(base, orientation) : { ...base };
}
