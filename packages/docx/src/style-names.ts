// Correspondance des styles integres localises : Word en francais ecrit « Titre1 », « Lgende », « Pieddepage » comme
// identifiants (accents retires) ; d'autres producteurs ecrivent aussi des noms francais (« Titre 1 »). Cette table
// ramene tout vers le nom interne canonique (« heading 1 », « caption »...) pour que l'editeur retrouve les titres.
import { BUILTIN_STYLE_NAMES } from './strings.ts';
import type { Style, StyleSheet } from './model-styles.ts';

/** Cle de comparaison : minuscules, lettres et chiffres seulement (accents conserves ou replies selon `fold`). */
const squash = (text: string, fold: boolean): string => {
  const lower = text.toLowerCase();
  return (fold ? lower.normalize('NFD').replace(/[̀-ͯ]/g, '') : lower).replace(/[^a-z0-9]/g, '');
};

/** Cle (identifiant ou nom, localise ou non) -> nom interne canonique d'un style integre. */
const ALIASES: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, french] of Object.entries(BUILTIN_STYLE_NAMES)) {
    for (const spelling of [canonical, french]) {
      // Identifiants Word : « Légende » -> « Lgende » (accents supprimes) ; noms : accents replies.
      map.set(squash(spelling, false), canonical);
      map.set(squash(spelling, true), canonical);
    }
  }
  // Identifiants ecrits par Word 365 en francais qui ne se deduisent pas du nom affiche.
  for (const [alias, canonical] of Object.entries({
    corpsdetexte: 'body text', normalweb: 'normal (web)', tableaunormal: 'normal table', policepardfaut: 'default paragraph font',
    aucuneliste: 'no list', listepuces: 'list bullet', listenumro: 'list number', textedebulles: 'balloon text',
    notedebasdepage: 'footnote text', appelnotedebasdep: 'footnote reference', tm1: 'toc 1', tm2: 'toc 2', tm3: 'toc 3',
    tm4: 'toc 4', tm5: 'toc 5', tm6: 'toc 6', tm7: 'toc 7', tm8: 'toc 8', tm9: 'toc 9', entte: 'header', enttedetabledesmatires: 'toc heading',
  })) map.set(alias, canonical);
  return map;
})();

const HEADING = /^heading ([1-9])$/;

/** Nom interne canonique d'un style integre (« heading 1 »), ou son nom tel quel s'il est personnalise / inconnu. */
export function canonicalStyleName(style: Pick<Style, 'id' | 'name' | 'custom'>): string {
  const own = style.name.toLowerCase();
  if (BUILTIN_STYLE_NAMES[own]) return own;
  if (style.custom) return style.name;
  return ALIASES.get(squash(style.name, false)) ?? ALIASES.get(squash(style.name, true))
    ?? ALIASES.get(squash(style.id, false)) ?? ALIASES.get(squash(style.id, true)) ?? style.name;
}

/** Niveau de titre (1..9) d'un style « Titre n », quelle que soit la langue de ses identifiants ; 0 sinon. */
export function headingLevelOfStyle(style: Pick<Style, 'id' | 'name' | 'custom'>): number {
  const match = canonicalStyleName(style).match(HEADING);
  return match ? Number(match[1]) : 0;
}

/** Identifiant du style dont le nom canonique est `canonical` (« heading 1 » -> « Titre1 » dans un document Word francais). */
export function findStyleId(styles: StyleSheet, canonical: string): string | undefined {
  return styles.styles.find((s) => s.type === 'paragraph' && canonicalStyleName(s) === canonical)?.id;
}
