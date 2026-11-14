// Styles de cellule de LibreOffice Calc (liste du panneau Styles de la vraie fenetre, relevee) -> style ForgeOffice le plus proche.
// Correspondance approchee : LibreOffice n'a pas les memes styles qu'Excel (« Statut », « Texte »... n'ont pas d'homonyme).
import type { GalleryItem } from '../../ribbon-types.ts';

export const LO_CELL_STYLES: ReadonlyArray<readonly [label: string, id: string]> = [
  ['Accent', 'total'], ['Accent 1', 'accent1'], ['Accent 2', 'accent2'], ['Accent 3', 'accent3'], ['Avertissement', 'warning'], ['Correct', 'good'], ['Erreur', 'bad'], ['Hyperlien', 'linked'],
  ['Incorrect', 'bad'], ['Neutre', 'neutral'], ['Note', 'note'], ['Note de bas de page', 'explanatory'], ['Par défaut', 'normal'], ['Résultat', 'output'], ['Statut', 'check'], ['Texte', 'input'],
  ['Titre', 'title'], ['Titre 1', 'heading1'], ['Titre 2', 'heading2'],
];

/** Les styles du ruban presentes sous les noms de LibreOffice (apercu du ruban conserve) ; un style sans homonyme reste a la fin sous son nom. */
export function loCellStyleItems(items: readonly GalleryItem[]): GalleryItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const mapped = LO_CELL_STYLES.flatMap(([label, id]) => { const it = byId.get(id); return it ? [{ ...it, label, sample: label, render: undefined }] : []; });
  return mapped;
}

/** Nom LibreOffice d'un style du ruban (le premier de la liste), ou son nom d'origine. */
export function loCellStyleLabel(id: string, fallback: string): string {
  return LO_CELL_STYLES.find(([, i]) => i === id)?.[0] ?? fallback;
}
