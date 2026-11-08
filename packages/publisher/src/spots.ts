// Tons directs (couleurs d'imprimerie nommees) : nom, couleur d'ecran (RVB) et valeur de remplacement CMJN en %.
// Dans le PDF imprimeur en CMJN, les aplats exactement de la couleur d'ecran d'un ton direct prennent sa valeur CMJN (pas la conversion generique).
import type { Deck } from '@forgeoffice/pptx';

export interface Spot {
  name: string;
  /** Couleur d'ecran #RRGGBB (majuscules). */
  rgb: string;
  /** Remplacement CMJN en % (cyan, magenta, jaune, noir). */
  cmyk: [number, number, number, number];
}

export const MAX_SPOTS = 64;
const MAX_NAME = 60;

const pct = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0);

export function parseSpots(value: unknown): Spot[] {
  const out: Spot[] = [];
  for (const item of (Array.isArray(value) ? value : []).slice(0, MAX_SPOTS)) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, MAX_NAME) : '';
    const rgb = typeof o.rgb === 'string' && /^#[0-9a-f]{6}$/i.test(o.rgb) ? o.rgb.toUpperCase() : '';
    const c = Array.isArray(o.cmyk) ? o.cmyk : [];
    if (!name || !rgb || out.some((s) => s.name === name || s.rgb === rgb)) continue;
    out.push({ name, rgb, cmyk: [pct(c[0]), pct(c[1]), pct(c[2]), pct(c[3])] });
  }
  return out;
}

/** Ajoute ou remplace (meme nom) un ton direct ; refuse une couleur d'ecran deja prise par un autre ton. */
export function saveSpot(spots: readonly Spot[], spot: Spot): Spot[] {
  const clean = parseSpots([spot])[0];
  if (!clean) return [...spots];
  if (spots.some((s) => s.rgb === clean.rgb && s.name !== clean.name)) return [...spots];
  const at = spots.findIndex((s) => s.name === clean.name);
  if (at >= 0) return spots.map((s, i) => (i === at ? clean : s));
  return spots.length >= MAX_SPOTS ? [...spots] : [...spots, clean];
}

export const removeSpot = (spots: readonly Spot[], name: string): Spot[] => spots.filter((s) => s.name !== name);

/** Table couleur d'ecran (r << 16 | g << 8 | b) -> octets CMJN, pour la conversion des pixels. */
export function spotLookup(spots: readonly Spot[]): Map<number, [number, number, number, number]> {
  const map = new Map<number, [number, number, number, number]>();
  for (const s of spots) map.set(parseInt(s.rgb.slice(1), 16), s.cmyk.map((v) => Math.round((v / 100) * 255)) as [number, number, number, number]);
  return map;
}

/** Tons directs dont la couleur d'ecran est utilisee dans le texte, les formes ou les arriere-plans des pages. */
export function usedSpots(deck: Deck, spots: readonly Spot[]): Spot[] {
  const json = JSON.stringify([deck.slides, deck.masters]).toUpperCase();
  return spots.filter((s) => json.includes(`"VALUE":"${s.rgb.slice(1)}"`));
}
