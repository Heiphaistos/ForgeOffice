// « Enregistrer en tant qu'image » : les objets selectionnes sont rendus sur fond transparent et enregistres en PNG.
import { createElement } from 'react';
import { PageView } from '../canvas/PageView.tsx';
import type { Box } from '../canvas/math.ts';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { errorText } from './fileops.ts';
import { imageRect } from './image-rect.ts';
import { rasterize } from './raster.ts';

const SCALE = 3;
const PAD = 2;

export async function saveSelectionAsImage(ed: Editor): Promise<void> {
  const shapes = ed.selectedShapes;
  const boxes = shapes.flatMap((raw): Box[] => {
    const x = ed.ctx.resolve(raw).xfrm;
    return x ? [{ x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation ?? 0, flipH: x.flipH, flipV: x.flipV }] : [];
  });
  const rect = imageRect(boxes, PAD);
  if (!rect) return;
  try {
    await document.fonts.ready;
    const view = createElement(PageView, { width: ed.deck.size.width, height: ed.deck.size.height, background: { type: 'none' }, ctx: ed.ctx, shapes, uid: 'img', style: { position: 'absolute', left: -rect.x, top: -rect.y, background: 'transparent' } });
    const host = createElement('div', { style: { position: 'relative', width: rect.width, height: rect.height, overflow: 'hidden' } }, view);
    const [blob] = await rasterize([host], ed.deck, { width: rect.width, height: rect.height, scale: SCALE, type: 'image/png', transparent: true });
    if (!blob) throw new Error(S3.image.failed);
    const saved = await ed.services.saveFile(new Uint8Array(await blob.arrayBuffer()), `${S3.image.fileName}.png`, [{ name: 'PNG', extensions: ['png'] }], null);
    if (saved) ed.notify(S.file.exported(saved.name), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}
