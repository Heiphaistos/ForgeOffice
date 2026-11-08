// Feuille de style d'une page (sans DOM) : colonnes remplies l'une apres l'autre et lettrines (initial-letter).
// L'habillage du texte autour des objets est rendu par des flottants (pagectx.ts, wrap.ts), pas par cette feuille.
// Portee : classe `pubp-<page>` de la page.
import type { Slide } from '@forgeoffice/pptx';
import { frameOf, isTextFrame } from './chain.ts';
import { shapeKey, type PubSettings } from './model.ts';

export const pageClass = (pageId: number): string => `pubp-${pageId}`;

/** Regles CSS de la page ; `accent` = couleur des lettrines ; `scopeClass` distingue deux publications affichees ensemble. */
export function pageCss(slide: Slide, pub: PubSettings, accent: string, scopeClass = pageClass(slide.id), pageIds: readonly number[] = []): string {
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
  if (pub.continued) rules.push(...continuationRules(slide, pub, pageIds, scope));
  return rules.join('\n');
}

// « Suite de la page » : ::before de la zone ; « Suite page » : ::after du texte (le ::after de la zone sert aux limites d'objet).
const label = (text: string, side: 'before' | 'after'): string =>
  `${side === 'after' ? ' [data-text-flow]' : ''}::${side}{content:"${text}";position:absolute;${side === 'after' ? 'bottom:2px;' : 'top:2px;'}right:6px;font:italic 8pt sans-serif;color:#555;pointer-events:none;}`;

/**
 * Indications de suite : « Suite page n » au pied de la derniere zone d'une page quand l'article continue sur une autre page,
 * « Suite de la page n » en tete de la zone qui reprend. Numeros = rang de la page dans `pageIds` (identifiants de page, dans l'ordre).
 */
export function continuationRules(slide: Slide, pub: PubSettings, pageIds: readonly number[], scope: string): string[] {
  const rules: string[] = [];
  const number = (id: number): number => pageIds.indexOf(id) + 1;
  const sel = (shape: number): string => `:is(${scope}[data-page], ${scope} [data-page]) > [data-shape-id="${shape}"]`;
  for (const chain of pub.chains) {
    chain.boxes.forEach((box, i) => {
      if (chain.empty[i]) return;
      const next = chain.boxes[i + 1];
      const prev = chain.boxes[i - 1];
      if (box.page === slide.id && next && next.page !== slide.id && number(next.page) > 0 && !chain.empty[i + 1]) rules.push(`${sel(box.shape)}${label(`Suite page ${number(next.page)}`, 'after')}`);
      if (box.page === slide.id && prev && prev.page !== slide.id && number(prev.page) > 0 && !chain.empty[i - 1]) rules.push(`${sel(box.shape)}${label(`Suite de la page ${number(prev.page)}`, 'before')}`);
    });
  }
  return rules;
}
