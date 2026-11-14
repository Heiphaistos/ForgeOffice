// Catalogues d'effets d'animation et de transitions (donnees pures partagees par le ruban, le volet et les tests).
import type { AnimationClass } from '@forgeoffice/pptx';
import type { IconName } from '@forgeoffice/ui';

/** Transitions proposees (type, parametres, icone). */
export const TRANSITIONS: ReadonlyArray<{ id: string; type: string; params?: Record<string, string>; group: 'subtle' | 'exciting' }> = [
  { id: 'none', type: 'none', group: 'subtle' },
  { id: 'morph', type: 'morph', group: 'subtle' },
  { id: 'fade', type: 'fade', group: 'subtle' },
  { id: 'push', type: 'push', params: { dir: 'u' }, group: 'subtle' },
  { id: 'wipe', type: 'wipe', params: { dir: 'l' }, group: 'subtle' },
  { id: 'split', type: 'split', params: { orient: 'vert', dir: 'out' }, group: 'subtle' },
  { id: 'reveal', type: 'reveal', group: 'subtle' },
  { id: 'cut', type: 'cut', group: 'subtle' },
  { id: 'randomBar', type: 'randomBar', params: { dir: 'vert' }, group: 'subtle' },
  { id: 'circle', type: 'circle', group: 'subtle' },
  { id: 'uncover', type: 'pull', params: { dir: 'l' }, group: 'subtle' },
  { id: 'cover', type: 'cover', params: { dir: 'l' }, group: 'subtle' },
  { id: 'flash', type: 'flash', group: 'subtle' },
  { id: 'zoom', type: 'zoom', group: 'exciting' },
  { id: 'vortex', type: 'vortex', params: { dir: 'r' }, group: 'exciting' },
  { id: 'flip', type: 'flip', params: { dir: 'r' }, group: 'exciting' },
  { id: 'cube', type: 'cube', params: { dir: 'l' }, group: 'exciting' },
  { id: 'gallery', type: 'gallery', params: { dir: 'l' }, group: 'exciting' },
  { id: 'doors', type: 'doors', params: { dir: 'vert' }, group: 'exciting' },
  { id: 'ripple', type: 'ripple', group: 'exciting' },
  { id: 'honeycomb', type: 'honeycomb', group: 'exciting' },
  { id: 'glitter', type: 'glitter', params: { dir: 'l' }, group: 'exciting' },
  { id: 'dissolve', type: 'dissolve', group: 'exciting' },
  { id: 'checker', type: 'checker', group: 'exciting' },
  { id: 'blinds', type: 'blinds', group: 'exciting' },
  { id: 'shred', type: 'shred', group: 'exciting' },
  { id: 'diamond', type: 'diamond', group: 'subtle' },
  { id: 'plus', type: 'plus', group: 'subtle' },
  { id: 'wheel', type: 'wheel', params: { spokes: '4' }, group: 'subtle' },
  { id: 'wedge', type: 'wedge', group: 'subtle' },
  { id: 'strips', type: 'strips', params: { dir: 'ru' }, group: 'subtle' },
  { id: 'switch', type: 'switch', params: { dir: 'l' }, group: 'exciting' },
  { id: 'window', type: 'window', params: { dir: 'vert' }, group: 'exciting' },
  { id: 'ferris', type: 'ferris', params: { dir: 'l' }, group: 'exciting' },
];

/** Effets d'animation de la galerie (classe, presetId, sous-type). */
export const EFFECTS: ReadonlyArray<{ id: string; cls: AnimationClass; preset: number; subtype?: number; icon: IconName; path?: string }> = [
  { id: 'entr:1', cls: 'entr', preset: 1, icon: 'star' },
  { id: 'entr:10', cls: 'entr', preset: 10, icon: 'star' },
  { id: 'entr:2', cls: 'entr', preset: 2, subtype: 4, icon: 'star' },
  { id: 'entr:42', cls: 'entr', preset: 42, icon: 'star' },
  { id: 'entr:16', cls: 'entr', preset: 16, subtype: 21, icon: 'star' },
  { id: 'entr:22', cls: 'entr', preset: 22, subtype: 4, icon: 'star' },
  { id: 'entr:6', cls: 'entr', preset: 6, subtype: 16, icon: 'star' },
  { id: 'entr:21', cls: 'entr', preset: 21, subtype: 1, icon: 'star' },
  { id: 'entr:14', cls: 'entr', preset: 14, subtype: 10, icon: 'star' },
  { id: 'entr:31', cls: 'entr', preset: 31, icon: 'star' },
  { id: 'entr:53', cls: 'entr', preset: 53, subtype: 16, icon: 'star' },
  { id: 'entr:26', cls: 'entr', preset: 26, icon: 'star' },
  { id: 'entr:3', cls: 'entr', preset: 3, icon: 'star' },
  { id: 'entr:8', cls: 'entr', preset: 8, icon: 'star' },
  { id: 'entr:9', cls: 'entr', preset: 9, icon: 'star' },
  { id: 'entr:23', cls: 'entr', preset: 23, icon: 'star' },
  { id: 'emph:26', cls: 'emph', preset: 26, icon: 'sparkle' },
  { id: 'emph:32', cls: 'emph', preset: 32, icon: 'sparkle' },
  { id: 'emph:8', cls: 'emph', preset: 8, icon: 'sparkle' },
  { id: 'emph:6', cls: 'emph', preset: 6, icon: 'sparkle' },
  { id: 'emph:9', cls: 'emph', preset: 9, icon: 'sparkle' },
  { id: 'exit:1', cls: 'exit', preset: 1, icon: 'dismiss' },
  { id: 'exit:10', cls: 'exit', preset: 10, icon: 'dismiss' },
  { id: 'exit:2', cls: 'exit', preset: 2, subtype: 4, icon: 'dismiss' },
  { id: 'exit:42', cls: 'exit', preset: 42, icon: 'dismiss' },
  { id: 'exit:16', cls: 'exit', preset: 16, subtype: 21, icon: 'dismiss' },
  { id: 'exit:22', cls: 'exit', preset: 22, subtype: 4, icon: 'dismiss' },
  { id: 'exit:53', cls: 'exit', preset: 53, subtype: 16, icon: 'dismiss' },
  { id: 'exit:3', cls: 'exit', preset: 3, icon: 'dismiss' },
  { id: 'exit:8', cls: 'exit', preset: 8, icon: 'dismiss' },
  { id: 'exit:9', cls: 'exit', preset: 9, icon: 'dismiss' },
  { id: 'exit:6', cls: 'exit', preset: 6, subtype: 16, icon: 'dismiss' },
  { id: 'exit:14', cls: 'exit', preset: 14, subtype: 10, icon: 'dismiss' },
  { id: 'exit:21', cls: 'exit', preset: 21, subtype: 1, icon: 'dismiss' },
  { id: 'exit:26', cls: 'exit', preset: 26, icon: 'dismiss' },
  { id: 'exit:31', cls: 'exit', preset: 31, icon: 'dismiss' },
  { id: 'exit:23', cls: 'exit', preset: 23, icon: 'dismiss' },
  { id: 'path:line', cls: 'path', preset: 0, icon: 'arrow_down', path: 'M 0 0 L 0 0.25 E' },
  { id: 'path:right', cls: 'path', preset: 0, icon: 'arrow_right', path: 'M 0 0 L 0.25 0 E' },
  { id: 'path:arc', cls: 'path', preset: 0, icon: 'arrow_clockwise', path: 'M 0 0 C 0.07 0 0.13 0.06 0.13 0.13 C 0.13 0.2 0.07 0.25 0 0.25 E' },
  { id: 'path:up', cls: 'path', preset: 0, icon: 'arrow_up', path: 'M 0 0 L 0 -0.25 E' },
  { id: 'path:left', cls: 'path', preset: 0, icon: 'arrow_left', path: 'M 0 0 L -0.25 0 E' },
  { id: 'path:diag', cls: 'path', preset: 0, icon: 'arrow_right', path: 'M 0 0 L 0.2 0.2 E' },
  { id: 'path:zigzag', cls: 'path', preset: 0, icon: 'arrow_sync', path: 'M 0 0 L 0.08 0.15 L 0.16 0 L 0.24 0.15 E' },
  { id: 'path:circle', cls: 'path', preset: 0, icon: 'circle', path: 'M 0 0 C 0.05 -0.1 0.2 -0.1 0.2 0 C 0.2 0.1 0.05 0.1 0 0 Z' },
  { id: 'path:loop', cls: 'path', preset: 0, icon: 'arrow_sync', path: 'M 0 0 C 0.1 -0.1 0.2 0 0.1 0.1 C 0 0.2 -0.1 0.1 0 0 Z' },
];


/** Profil OnlyOffice : libelles de la galerie Transitions d'OnlyOffice Desktop 10.0, dans son ordre (Discret puis Captivant puis Contenu dynamique).
 *  Chaque libelle est pose sur l'effet de NOTRE moteur le plus proche (id du moteur -> nom OnlyOffice) ; les effets d'OnlyOffice sans equivalent
 *  (Entrelace, Boite, Aleatoire, Faire pivoter, Orbite, Retourner) ne sont PAS proposes : pas de faux effet. Nos effets sans nom OnlyOffice
 *  (reveal, flash, glitter, shred, diamond, plus, wedge, strips, switch) restent a la suite sous leur nom habituel. */
export const OO_TRANSITION_NAMES: Readonly<Record<string, string>> = {
  none: 'Aucune', morph: 'Transformation', fade: 'Fondu', push: 'Expulsion', wipe: 'Effacer', split: 'Diviser', cut: 'Coupe', randomBar: 'Barres aléatoires',
  circle: 'Forme', uncover: 'Découvrir', cover: 'Couvrir',
  dissolve: 'Dissoudre', checker: 'Damier', blinds: 'Stores', wheel: 'Horloge', ripple: 'Ondulation', honeycomb: 'Alvéole', vortex: 'Tourbillon', flip: 'Basculer',
  gallery: 'Galerie', cube: 'Cube', doors: 'Portes', zoom: 'Zoom',
  ferris: 'Grande roue', window: 'Fenêtre',
};
const OO_ORDER = Object.keys(OO_TRANSITION_NAMES);

/** Transitions dans l'ordre d'OnlyOffice (profil OnlyOffice) : celles qui portent un nom OnlyOffice d'abord, les autres a la suite. */
export function ooTransitionOrder(list: typeof TRANSITIONS): typeof TRANSITIONS {
  const rank = (id: string): number => { const i = OO_ORDER.indexOf(id); return i < 0 ? 999 : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Libelles d'animation d'OnlyOffice differents des nôtres (releves dans la galerie des effets d'entree). */
export const OO_EFFECT_NAMES: Readonly<Record<string, string>> = { 'entr:2': 'Passage vers l’intérieur', 'entr:22': 'Effacer' };
