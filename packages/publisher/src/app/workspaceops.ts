// Zone de travail et pages voisines : mettre les objets selectionnes en reserve hors de la page, les replacer, les envoyer a une autre page.
import { locate } from '@forgeoffice/powerpoint/canvas';
import { S } from '../strings.ts';
import { moveShapesToPage, placeInPage, reservePosition } from '../workspace.ts';
import type { Editor } from './editor.ts';

/** Zone de travail : objets a gauche de la page (visibles a l'ecran, jamais imprimes). */
export function reserveSelection(ed: Editor): void {
  const ids = ed.selection.ids;
  ed.editShapes((shapes) => {
    for (const id of ids) {
      const s = locate(shapes, id)?.shape;
      if (s?.xfrm) s.xfrm = { ...s.xfrm, ...reservePosition(s.xfrm) };
    }
  }, 'reserve');
}

/** Ramene les objets selectionnes dans la page, a l'interieur des marges quand elles le permettent. */
export function restoreSelection(ed: Editor): void {
  const margin = Math.min(ed.pub.margins.inside, ed.pub.margins.outside);
  const ids = ed.selection.ids;
  ed.editShapes((shapes) => {
    for (const id of ids) {
      const s = locate(shapes, id)?.shape;
      if (s?.xfrm) s.xfrm = { ...s.xfrm, ...placeInPage(s.xfrm, ed.deck.size, margin) };
    }
  }, 'restore');
}

/** Envoie les objets selectionnes a la page precedente (-1) ou suivante (+1) ; refuse les zones d'un article chaine. */
export function sendToPage(ed: Editor, delta: -1 | 1): void {
  const to = ed.pageIndex + delta;
  const result = moveShapesToPage(ed.deck, ed.pub, ed.pageIndex, to, ed.selection.ids);
  if ('error' in result) {
    ed.notify(result.error === 'chained' ? S.workspace.chained : S.workspace.nowhere, 'warning');
    return;
  }
  ed.commitDeck(result.deck, 'move-to-page');
  ed.goto(to);
  ed.setSelection({ ids: result.ids });
}
