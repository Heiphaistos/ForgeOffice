// Images du publipostage : ZIP choisi par l'utilisateur (garde en memoire pour la session) et liaison d'une image a un champ.
import { shapeKey } from '../model.ts';
import { readImageZip, type ImageBank } from '../mergeimages.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';

let bank: ImageBank = new Map();
export const currentImageBank = (): ImageBank => bank;

/** Choisit un ZIP d'images et le garde pour la fusion. */
export async function loadImageZip(ed: Editor): Promise<void> {
  const file = await ed.services.openFile([{ name: S.imageMerge.filter, extensions: ['zip'] }]);
  if (!file) return;
  try {
    const next = await readImageZip(file.bytes);
    if (!next.size) {
      ed.notify(S.imageMerge.empty(file.name), 'warning');
      return;
    }
    bank = next;
    ed.notify(S.imageMerge.loaded(next.size, file.name), 'success');
  } catch (err) {
    ed.notify(`${S.app.openFailed(file.name)} ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** Lie l'image selectionnee a un champ de la source (null = supprime la liaison). */
export function linkImageField(ed: Editor, field: string | null): void {
  const id = ed.selection.ids[0];
  const shape = id === undefined ? undefined : ed.pageShapes.find((s) => s.id === id);
  if (ed.ref.kind !== 'page' || shape?.kind !== 'picture') {
    ed.notify(S.imageMerge.needPicture, 'warning');
    return;
  }
  const key = shapeKey(ed.ref.id, shape.id);
  const imageFields = { ...ed.pub.imageFields };
  if (field === null) delete imageFields[key];
  else imageFields[key] = field;
  ed.commitPub({ ...ed.pub, imageFields }, 'imagefield');
  ed.notify(field === null ? S.imageMerge.unlinked : S.imageMerge.linked(field), 'info');
}
