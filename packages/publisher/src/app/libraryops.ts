// Bibliotheque personnelle de blocs : enregistrer la selection, inserer un bloc au centre de la page, supprimer.
import { insertCopies, locate } from '@forgeoffice/powerpoint/canvas';
import { marginBox } from '../guides.ts';
import { addBlock, captureBlock, LIBRARY_SETTING, parseLibrary, removeBlock, type LibraryBlock } from '../library.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';

export const loadLibrary = (ed: Editor): LibraryBlock[] => parseLibrary(ed.services.settings.get<unknown>(LIBRARY_SETTING, []));

/** Enregistre les objets selectionnes dans la bibliotheque (remplace le bloc de meme nom). */
export function saveSelectionAsBlock(ed: Editor, name: string): boolean {
  const shapes = ed.selection.ids.map((id) => locate(ed.pageShapes, id)?.shape).filter((s) => s !== undefined);
  const library = loadLibrary(ed);
  const { block, skipped } = captureBlock(name, shapes, library);
  if (!block) {
    ed.notify(S.library.nothing, 'warning');
    return false;
  }
  ed.services.settings.set(LIBRARY_SETTING, addBlock(library, block));
  ed.notify(skipped ? `${S.library.saved(block.name)} ${S.library.skipped(skipped)}` : S.library.saved(block.name), skipped ? 'warning' : 'success');
  return true;
}

/** Insere le bloc au centre de la zone de marges de la page active (reduit s'il est trop grand) et le selectionne. */
export function insertLibraryBlock(ed: Editor, block: LibraryBlock): void {
  const area = marginBox(ed.deck.size, ed.pub, ed.pageIndex);
  const k = Math.min(1, area.width / block.width, area.height / block.height);
  const dx = area.x + (area.width - block.width * k) / 2;
  const dy = area.y + (area.height - block.height * k) / 2;
  let ids: number[] = [];
  ed.editShapes((shapes) => {
    ids = insertCopies(shapes, block.shapes.map((s) => (s.xfrm && k < 1 ? { ...structuredClone(s), xfrm: { ...s.xfrm, x: s.xfrm.x * k, y: s.xfrm.y * k, width: s.xfrm.width * k, height: s.xfrm.height * k } } : s)), { x: dx, y: dy });
  }, 'insert');
  ed.setSelection({ ids });
}

export function deleteLibraryBlock(ed: Editor, id: string): void {
  ed.services.settings.set(LIBRARY_SETTING, removeBlock(loadLibrary(ed), id));
  ed.notify(S.library.removed, 'info');
}
