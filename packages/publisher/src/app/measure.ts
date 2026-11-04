// Mesure du texte dans le navigateur (canvas 2D) pour la repartition des articles, et detection des polices installees.
import { deckTheme, fontStack, resolveThemeFont, type Deck, type RunProps, type Theme } from '@forgeoffice/pptx';
import { whenFontsReady } from '@forgeoffice/ui';
import type { MeasureFn } from '../flow.ts';

/** Marge de securite : mieux vaut couper une ligne trop tot que voir le navigateur la renvoyer hors de la zone. */
const SAFETY = 1.03;

/** Familles de polices du theme du document : a charger avant toute mesure ou exportation (voir whenFontsReady). */
export function deckFonts(deck: Deck): string[] {
  const t = deckTheme(deck);
  return [...new Set([t.fonts.major.latin, t.fonts.minor.latin].filter(Boolean))];
}

/** Lance une sortie (PDF, images) une fois les polices du document chargees : la composition et le rendu utilisent alors les vraies largeurs. */
export function afterFonts(ed: { deck: Deck }, run: () => Promise<void>): Promise<void> {
  return whenFontsReady(deckFonts(ed.deck)).then(run);
}

/** Mesure de texte par canvas. Le cache de largeurs est propre a chaque instance : en creer une nouvelle apres le chargement des polices. */
export function createMeasure(theme: Theme): MeasureFn {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const cache = new Map<string, number>();
  return (text: string, props: RunProps): number => {
    const size = props.size ?? 18;
    const family = fontStack(resolveThemeFont(props.font, theme) ?? theme.fonts.minor.latin, theme);
    const font = `${props.italic ? 'italic ' : ''}${props.bold ? '700 ' : ''}${size}px ${family}`;
    const key = `${font}|${props.spacing ?? 0}|${props.caps ?? ''}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (!g) return text.length * size * 0.55;
    g.font = font;
    const shown = props.caps === 'all' ? text.toUpperCase() : text;
    const width = (g.measureText(shown).width + (props.spacing ?? 0) * shown.length) * SAFETY;
    if (cache.size > 50_000) cache.clear();
    cache.set(key, width);
    return width;
  };
}

const known = new Map<string, boolean>();

/** Police installee ? (comparaison de largeurs avec les familles generiques de repli). */
export function fontAvailable(name: string): boolean {
  const hit = known.get(name);
  if (hit !== undefined) return hit;
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return true;
  const sample = 'mmmmmmmmmmlli WQ@#';
  const widthWith = (family: string): number => {
    g.font = `72px ${family}`;
    return g.measureText(sample).width;
  };
  const quoted = `"${name.replace(/"/g, '')}"`;
  const ok = ['monospace', 'serif', 'sans-serif'].some((base) => widthWith(`${quoted}, ${base}`) !== widthWith(base));
  known.set(name, ok);
  return ok;
}
