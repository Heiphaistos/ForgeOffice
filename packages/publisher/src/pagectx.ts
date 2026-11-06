// Contexte de rendu d'une page de la publication : ajoute l'habillage du texte (flottants invisibles qui ecartent le texte
// des objets) au contexte du moteur de page. Un seul calcul (wrap.ts) sert a la mesure du texte et au rendu.
import type { Slide } from '@forgeoffice/pptx';
import type { PageContext } from '@forgeoffice/powerpoint/canvas';
import { frameOf, isTextFrame } from './chain.ts';
import type { PubSettings } from './model.ts';
import { wrapFloats } from './wrap.ts';

export function withWrap(ctx: PageContext, slide: Slide, pub: PubSettings): PageContext {
  return {
    ...ctx,
    wrapFloats: (shape) => {
      const real = slide.shapes.find((s) => s.id === shape.id);
      if (!real || !isTextFrame(real)) return undefined;
      const floats = wrapFloats(frameOf(slide, real, pub));
      return floats.length ? floats : undefined;
    },
  };
}
