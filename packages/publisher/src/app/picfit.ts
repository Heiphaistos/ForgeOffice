// « Remplir » et « Ajuster » : adapte l'image selectionnee a son cadre (rognage centre / cadre aux proportions de l'image).
import type { Picture } from '@forgeoffice/pptx';
import { applyCrop, fillFull, fitFrame, fullRect, type Rect } from '../crop.ts';
import type { Editor } from './editor.ts';

export type FitMode = 'fill' | 'fit';

export function fitPicture(ed: Editor, mode: FitMode): void {
  ed.editSelected((s) => {
    if (s.kind !== 'picture' || !s.xfrm) return;
    const frame: Rect = { x: s.xfrm.x, y: s.xfrm.y, width: s.xfrm.width, height: s.xfrm.height };
    if (mode === 'fill') {
      applyCrop(s, frame, fillFull(frame, s.crop), frame);
      return;
    }
    const next = fitFrame(frame, s.crop);
    // Sans rognage : l'image entiere occupe exactement le nouveau cadre (rectangle d'origine pour la rotation = ancien cadre).
    applyCrop(s as Picture, next, fullRect(next), frame);
  }, 'picfit');
}
