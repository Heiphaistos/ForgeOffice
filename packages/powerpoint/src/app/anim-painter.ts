// Reproduire l'animation : copie les animations d'une forme puis les applique a la forme selectionnee ensuite.
import type { Animation } from '@forgeoffice/pptx';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';
import { pasteAnimations } from './effect-model.ts';
import { editAnimations, selectedAnimations } from './ribbon/motion.tsx';

let copied: Animation[] | null = null;

export const hasCopiedAnimation = (): boolean => copied !== null;

/** Premier appui : copie les animations de la forme selectionnee. Appui suivant : les applique a la selection. */
export function animationPainter(ed: Editor): void {
  const own = selectedAnimations(ed);
  if (!copied) {
    if (!own.length) return;
    copied = structuredClone(own);
    ed.notify(S3.effect.painterCopied, 'info');
    return;
  }
  const source = copied;
  copied = null;
  if (!ed.selection.ids.length) return;
  editAnimations(ed, (list, targets) => pasteAnimations(list, targets, source), 'animPainter');
  ed.notify(S3.effect.painterApplied, 'info');
}
