// F6 / Maj+F6 : parcourt les zones de l'ecran (grille, onglets de feuille, ruban). Ecoute au niveau de la fenetre pour marcher
// aussi quand le focus est dans le ruban ou les onglets, ou le clavier de la grille ne recoit rien.
interface Zone {
  /** Conteneur : le focus est « dans la zone » s'il s'y trouve. */
  container: string;
  /** Element qui recoit le focus en entrant dans la zone. */
  target: string;
}

export const ZONES: readonly Zone[] = [
  { container: '.xl-grid', target: '.xl-grid' },
  { container: '.xl-tabs', target: '.xl-tabs [role="tab"][aria-selected="true"]' },
  { container: '.fo-ribbon', target: '.fo-ribbon [role="tab"][aria-selected="true"]' },
];

/** Zone suivante (delta 1) ou precedente (-1), en bouclant ; hors de toute zone (-1), on entre par le debut ou la fin. */
export function nextZone(current: number, delta: 1 | -1, count: number): number {
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/** Deplace le focus vers la zone suivante/precedente ; faux si aucune zone n'est affichee. */
export function cycleZone(doc: Document, delta: 1 | -1): boolean {
  const active = doc.activeElement;
  const present = ZONES.map((z) => ({ z, el: doc.querySelector<HTMLElement>(z.target), box: doc.querySelector<HTMLElement>(z.container) })).filter((p) => p.el && p.box);
  if (!present.length) return false;
  const here = present.findIndex((p) => p.box?.contains(active));
  const target = present[nextZone(here, delta, present.length)]?.el;
  target?.focus();
  return !!target;
}

/** Installe l'ecoute de F6 sur la fenetre ; renvoie la fonction qui la retire. */
export function installZoneKeys(): () => void {
  const on = (e: KeyboardEvent): void => {
    if (e.key !== 'F6' || e.ctrlKey || e.altKey || e.metaKey) return;
    if (cycleZone(document, e.shiftKey ? -1 : 1)) e.preventDefault();
  };
  window.addEventListener('keydown', on);
  return () => window.removeEventListener('keydown', on);
}

/** Evenement de fenetre : developper / reduire la barre de formule (Ctrl+Maj+U). */
export const TOGGLE_FORMULA_BAR = 'xl:toggle-fbar';
export const toggleFormulaBar = (): void => void (globalThis as { dispatchEvent?: (e: Event) => boolean }).dispatchEvent?.(new Event(TOGGLE_FORMULA_BAR));
