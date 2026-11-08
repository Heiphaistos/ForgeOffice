// Tabulations simples : un seul taquet gauche ou l'intervalle par defaut passent par `tab-size` ; les autres cas : tab-layout.ts.
import type { ParagraphProps } from '@forgeoffice/pptx';

/** Intervalle de tabulation par defaut d'Office (2,54 cm). */
export const DEFAULT_TAB_PT = 72;

/**
 * Intervalle CSS (points) des tabulations d'un paragraphe : premier taquet personnalise, sinon l'intervalle par defaut.
 */
export function tabIntervalPt(p: ParagraphProps): number {
  const first = p.tabs?.map((t) => t.position).filter((v) => v > 0).sort((a, b) => a - b)[0];
  return first ?? (p.defaultTabSize && p.defaultTabSize > 0 ? p.defaultTabSize : DEFAULT_TAB_PT);
}
