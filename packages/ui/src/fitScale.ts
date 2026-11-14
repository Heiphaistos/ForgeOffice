// Mode « Reduire » : mise a l'echelle (zoom CSS) d'une barre qui ne tient pas dans la largeur. Sous le plancher, la barre passe aussi a la ligne.
import { useLayoutEffect } from 'react';

/** Echelle minimale : en dessous, le texte devient illisible et la barre passe a la ligne (en plus de l'echelle). */
export const MIN_SCALE = 0.6;

/** Zoom CSS (arrondi par defaut) qui fait tenir `need` px dans `avail` px ; 1 si deja assez large. */
export function scaleFor(need: number, avail: number): number {
  if (need <= avail || need <= 0 || avail <= 0) return 1;
  return Math.max(MIN_SCALE, Math.floor((avail / need) * 100) / 100);
}

/** Applique l'echelle a `el` : `need` = largeur naturelle du contenu, `avail` = largeur disponible (mesures a zoom 1). */
export function applyScale(el: HTMLElement, need: number, avail: number): void {
  const z = scaleFor(need, avail);
  el.style.zoom = z < 1 ? String(z) : '';
  if (need > avail && avail / need < MIN_SCALE) el.dataset.fitWrap = '1';
}

/** Remet l'element a son etat naturel avant une mesure. */
export function resetScale(el: HTMLElement): void {
  el.style.zoom = '';
  delete el.dataset.fitWrap;
}

/** Barres a une ligne (menus + barres d'outils) : chacune est reduite pour tenir ; a refaire a chaque rendu et a chaque changement de largeur. */
export function useScaleRows(enabled: boolean, selector: string): void {
  useLayoutEffect(() => {
    const run = (): void => {
      const rows = [...document.querySelectorAll<HTMLElement>(selector)];
      for (const el of rows) resetScale(el);
      for (const el of rows) applyScale(el, el.scrollWidth, el.clientWidth);
    };
    const rows = [...document.querySelectorAll<HTMLElement>(selector)];
    if (!enabled) {
      rows.forEach(resetScale);
      return undefined;
    }
    run();
    const ro = new ResizeObserver(run);
    ro.observe(document.documentElement);
    void document.fonts?.ready.then(run);
    return () => ro.disconnect();
  });
}
