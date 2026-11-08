// Élément SmartArt « courant » : la ligne où se trouve le curseur dans le volet Texte (les boutons de l'onglet SmartArt agissent dessus).
let line: number | null = null;

export const smartArtCursor = (): number | null => line;
export function setSmartArtCursor(next: number | null): void {
  line = next;
}

/** Indice de l'élément courant, borné au nombre d'éléments (le dernier si aucun curseur). */
export function currentItem(count: number): number {
  return count === 0 ? -1 : Math.min(count - 1, line ?? count - 1);
}
