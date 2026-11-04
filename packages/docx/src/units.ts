// Conversions d'unites. Le modele est en points ; OOXML utilise twips (1/20 pt), demi-points,
// huitiemes de point et EMU (1/12700 pt).

const round = (value: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export const twipsToPt = (twips: number): number => round(twips / 20);
export const ptToTwips = (pt: number): number => Math.round(pt * 20);
export const halfPtToPt = (half: number): number => round(half / 2);
export const ptToHalfPt = (pt: number): number => Math.round(pt * 2);
export const eighthPtToPt = (eighths: number): number => round(eighths / 8, 3);
export const ptToEighthPt = (pt: number): number => Math.round(pt * 8);
export const emuToPt = (emu: number): number => round(emu / 12700);
export const ptToEmu = (pt: number): number => Math.round(pt * 12700);
/** Interligne automatique : 240 = simple. */
export const lineToMultiple = (line: number): number => round(line / 240, 2);
export const multipleToLine = (multiple: number): number => Math.round(multiple * 240);
export const pxToPt = (px: number): number => round(px * 0.75);
export const ptToPx = (pt: number): number => round(pt / 0.75);
export const cmToPt = (cm: number): number => round((cm * 72) / 2.54);
export const inToPt = (inches: number): number => round(inches * 72);

/** Longueur CSS / ODF (« 2.5cm », « 12pt », « 0.5in », « 16px », « 1.2em ») en points. `emBase` en points. */
export function parseLength(raw: string | undefined, emBase = 12): number | undefined {
  if (!raw) return undefined;
  const m = /^\s*(-?\d*\.?\d+)\s*(pt|px|cm|mm|in|pc|em|rem|%)?\s*$/i.exec(raw);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  switch ((m[2] ?? 'px').toLowerCase()) {
    case 'pt': return round(value);
    case 'px': return pxToPt(value);
    case 'cm': return cmToPt(value);
    case 'mm': return cmToPt(value / 10);
    case 'in': return inToPt(value);
    case 'pc': return round(value * 12);
    case 'em':
    case 'rem': return round(value * emBase);
    default: return undefined;
  }
}

/** Formate des points en unite ODF / CSS. */
export const fmtPt = (pt: number): string => `${round(pt)}pt`;
export const fmtCm = (pt: number): string => `${round((pt * 2.54) / 72, 3)}cm`;

/** Borne une valeur numerique lue d'un fichier. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
