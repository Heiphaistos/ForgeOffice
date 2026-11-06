// Feuille de style d'une page (sans DOM) : colonnes remplies l'une apres l'autre et lettrines (initial-letter).
// L'habillage du texte autour des objets est rendu par des flottants (pagectx.ts, wrap.ts), pas par cette feuille.
// Portee : classe `pubp-<page>` de la page.
import type { Slide } from '@forgeoffice/pptx';
import { frameOf, isTextFrame } from './chain.ts';
import { shapeKey, type PubSettings } from './model.ts';

export const pageClass = (pageId: number): string => `pubp-${pageId}`;

/** Regles CSS de la page ; `accent` = couleur des lettrines ; `scopeClass` distingue deux publications affichees ensemble. */
export function pageCss(slide: Slide, pub: PubSettings, accent: string, scopeClass = pageClass(slide.id)): string {
  const scope = `.${scopeClass}`;
  const rules: string[] = [];
  for (const shape of slide.shapes) {
    if (!isTextFrame(shape)) continue;
    // La classe porte sur la page elle-meme (miniature, export) ou sur l'editeur qui la contient.
    const sel = `:is(${scope}[data-page], ${scope} [data-page]) > [data-shape-id="${shape.id}"]`;
    const frame = frameOf(slide, shape, pub);
    // Les colonnes se remplissent l'une apres l'autre (comme la mesure du texte) : sans cela le navigateur les equilibre.
    if (frame.columns > 1) rules.push(`${sel} [data-text-flow]{column-fill:auto;}`);
    const drop = pub.dropCaps[shapeKey(slide.id, shape.id)];
    if (drop) rules.push(`${sel} [data-text-flow] > [data-p="0"]::first-letter{initial-letter:${drop};font-weight:700;color:${accent};margin-right:0.1em;}`);
  }
  return rules.join('\n');
}
