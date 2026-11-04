// Zoom de la barre d'etat : curseur non lineaire comme Office (10-100 % a gauche, 100-500 % a droite).

export const ZOOM_MIN = 10;
export const ZOOM_MAX = 500;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value)));
}

/** Position du curseur (0..1) -> zoom en %. Le milieu vaut 100 %. */
export function sliderToZoom(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  if (p <= 0.5) return clampZoom(ZOOM_MIN + (p / 0.5) * (100 - ZOOM_MIN));
  return clampZoom(100 + ((p - 0.5) / 0.5) * (ZOOM_MAX - 100));
}

export function zoomToSlider(zoom: number): number {
  const z = clampZoom(zoom);
  if (z <= 100) return ((z - ZOOM_MIN) / (100 - ZOOM_MIN)) * 0.5;
  return 0.5 + ((z - 100) / (ZOOM_MAX - 100)) * 0.5;
}

/** Bouton +/- : pas de 10 % (aligne sur la dizaine), comme Office. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const z = clampZoom(zoom);
  const aligned = direction > 0 ? Math.floor(z / 10) * 10 + 10 : Math.ceil(z / 10) * 10 - 10;
  return clampZoom(aligned);
}

/** Valeurs proposees dans la boite de dialogue Zoom. */
export const ZOOM_PRESETS: readonly number[] = [500, 200, 150, 100, 75, 50, 25];

/** Zoom apres un pincement : proportionnel a l'ecart des doigts (`startDist` -> `dist`), borne a [min, max] %. */
export function pinchZoom(startZoom: number, startDist: number, dist: number, min = ZOOM_MIN, max = ZOOM_MAX): number {
  if (!(startDist > 0) || !(dist > 0)) return Math.min(max, Math.max(min, Math.round(startZoom)));
  return Math.min(max, Math.max(min, Math.round((startZoom * dist) / startDist)));
}
