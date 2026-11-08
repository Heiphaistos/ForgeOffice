// Règles des onglets (sans DOM, testé) : fermetures groupées qui épargnent les onglets épinglés, ordre des onglets épinglés.

export interface TabLike {
  id: string;
  pinned: boolean;
  dirty: boolean;
}

export type CloseMode = 'left' | 'right' | 'others' | 'unchanged' | 'all';

/** Onglets à fermer pour un mode donné, depuis l'onglet `anchor` ; un onglet épinglé n'est jamais fermé en groupe. */
export function tabsToClose(tabs: readonly TabLike[], anchor: string, mode: CloseMode): string[] {
  const index = tabs.findIndex((t) => t.id === anchor);
  const pick = (t: TabLike, i: number): boolean => {
    switch (mode) {
      case 'left': return i < index;
      case 'right': return i > index;
      case 'others': return t.id !== anchor;
      case 'unchanged': return !t.dirty;
      case 'all': return true;
    }
  };
  return tabs.filter((t, i) => !t.pinned && pick(t, i)).map((t) => t.id);
}

/** Index de destination d'un onglet déplacé : les épinglés restent groupés à gauche, les autres à droite. */
export function clampMove(tabs: readonly TabLike[], id: string, toIndex: number): number {
  const pinnedCount = tabs.filter((t) => t.pinned).length;
  const moved = tabs.find((t) => t.id === id);
  if (!moved) return toIndex;
  return moved.pinned ? Math.min(toIndex, pinnedCount - 1) : Math.max(toIndex, pinnedCount);
}

/** Position d'un onglet qu'on épingle ou désépingle : juste après les onglets épinglés restants (fin du bloc épinglé, ou début des autres). */
export function pinTarget(tabs: readonly TabLike[], id: string): number {
  return tabs.filter((t) => t.id !== id && t.pinned).length;
}
