// Curseur d'insertion (sans DOM) : reglages communs aux applications de texte (epaisseur, couleur, clignotement).

export type CaretColor = 'auto' | 'accent' | 'black' | 'white';

export interface CaretPrefs {
  /** Epaisseur en pixels (1, 2 ou 3). */
  width: 1 | 2 | 3;
  color: CaretColor;
  blink: boolean;
}

export const DEFAULT_CARET: CaretPrefs = { width: 2, color: 'auto', blink: true };

/** Lecture tolerante d'un reglage enregistre (valeur inconnue ou hostile -> valeur par defaut). */
export function parseCaret(raw: unknown): CaretPrefs {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CARET;
  const o = raw as Record<string, unknown>;
  const width = o.width === 1 || o.width === 2 || o.width === 3 ? o.width : DEFAULT_CARET.width;
  const color: CaretColor = o.color === 'accent' || o.color === 'black' || o.color === 'white' || o.color === 'auto' ? o.color : DEFAULT_CARET.color;
  return { width, color, blink: typeof o.blink === 'boolean' ? o.blink : DEFAULT_CARET.blink };
}

/** Luminance relative (0..1) d'une couleur #RRGGBB ; 1 pour une valeur illisible (fond clair). */
export function luminance(hex: string | null | undefined): number {
  const m = (hex ?? '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 1;
  const n = Number.parseInt(m[1]!, 16);
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}

/** Couleur du curseur sur un fond donne : auto = noir sur fond clair, blanc sur fond sombre. */
export function caretColor(prefs: CaretPrefs, background: string | null | undefined, accent: string): string {
  if (prefs.color === 'accent') return accent;
  if (prefs.color === 'black') return '#000000';
  if (prefs.color === 'white') return '#FFFFFF';
  return luminance(background) < 0.4 ? '#FFFFFF' : '#000000';
}
