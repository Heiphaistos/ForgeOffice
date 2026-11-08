// Revision : navigation entre commentaires et notes, affichage permanent des notes.
import type { CellAddress, Note, Sheet } from '@forgeoffice/xlsx';

/** Cellules portant une note ou un commentaire, dans l'ordre de lecture (ligne puis colonne), sans doublon. */
export function reviewTargets(sheet: Pick<Sheet, 'notes' | 'threadedComments'>): CellAddress[] {
  const all = [...sheet.notes.map((n) => n.ref), ...sheet.threadedComments.map((c) => c.ref)];
  const seen = new Set<string>();
  return all
    .filter((a) => !seen.has(`${a.row}:${a.col}`) && !!seen.add(`${a.row}:${a.col}`))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Cible suivante (dir = 1) ou precedente (dir = -1) apres `from`, avec retour a l'autre bout ; undefined s'il n'y en a aucune. */
export function neighbourTarget(targets: readonly CellAddress[], from: CellAddress, dir: 1 | -1): CellAddress | undefined {
  if (!targets.length) return undefined;
  const key = (a: CellAddress): number => a.row * 100_000 + a.col;
  const here = key(from);
  const next = dir === 1 ? targets.find((t) => key(t) > here) : [...targets].reverse().find((t) => key(t) < here);
  return next ?? (dir === 1 ? targets[0] : targets[targets.length - 1]);
}

/** Affiche ou masque en permanence toutes les notes. */
export const setNotesVisible = (notes: readonly Note[], visible: boolean): Note[] => notes.map((n) => ({ ...n, visible }));

export const allNotesVisible = (notes: readonly Note[]): boolean => notes.length > 0 && notes.every((n) => n.visible === true);
