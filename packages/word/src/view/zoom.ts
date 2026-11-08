// Calcul du zoom « Largeur de page » / « Pleine page » (sans DOM : dimensions passees en parametres).
export type ZoomFit = 'width' | 'page';

/** Zoom en % pour que la page tienne dans la zone visible (px, marges de 48 et 32 px). */
export function fitZoom(fit: ZoomFit, viewport: { width: number; height: number }, page: { width: number; height: number }): number {
  const byWidth = ((viewport.width - 48) / page.width) * 100;
  const value = fit === 'width' ? byWidth : Math.min(byWidth, ((viewport.height - 32) / page.height) * 100);
  return Math.max(10, Math.min(500, Math.round(value)));
}
