// Mini-barre flottante de selection (sans DOM) : position pres de la selection, regles de visibilite.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  /** La barre est sous la selection (pas assez de place au-dessus). */
  below: boolean;
}

const GAP = 8;

/** Pose la barre (largeur x hauteur) au-dessus de la selection, centree ; dessous si le haut manque ; toujours dans la fenetre. */
export function placeMiniToolbar(sel: Box, bar: { width: number; height: number }, view: { width: number; height: number }, margin = 8): Placement {
  const below = sel.top - bar.height - GAP < margin;
  const top = below ? sel.top + sel.height + GAP : sel.top - bar.height - GAP;
  const centered = sel.left + sel.width / 2 - bar.width / 2;
  const left = Math.max(margin, Math.min(centered, view.width - bar.width - margin));
  return { left, top: Math.max(margin, Math.min(top, view.height - bar.height - margin)), below };
}

export interface MiniToolbarInput {
  enabled: boolean;
  /** Selection non vide dans la zone editable. */
  hasSelection: boolean;
  /** Bouton de pointeur enfonce (selection en cours : on attend le relachement). */
  pointerDown: boolean;
  /** Ferme par Echap ou un clic ailleurs jusqu'a la prochaine selection. */
  dismissed: boolean;
  /** Le focus est dans la zone editable ou dans la barre. */
  focusInside: boolean;
}

export function miniToolbarVisible(i: MiniToolbarInput): boolean {
  return i.enabled && i.hasSelection && !i.pointerDown && !i.dismissed && i.focusInside;
}
