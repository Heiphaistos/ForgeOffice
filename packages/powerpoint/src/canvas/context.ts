// Contexte de rendu d'une page : theme, correspondance de couleurs, heritage des espaces reserves, medias, champs.
import { S } from '../strings.ts';
import {
  cssColor, DEFAULT_COLOR_MAP, effectiveBackground, effectiveColorMap, effectiveShape, findLayout, fontStack, placeholderPrompt, resolveThemeFont, shapeChain,
  type Color, type ColorMap, type Deck, type Fill, type Layout, type Master, type MediaItem, type Paragraph, type Shape, type Slide, type Theme,
} from '@forgeoffice/pptx';

export interface PageContext {
  theme: Theme;
  colorMap: ColorMap;
  /** Forme effective (heritage disposition / masque) ; identite hors presentation. */
  resolve: (shape: Shape) => Shape;
  media: (id: string) => MediaItem | undefined;
  /** Texte d'invite d'un espace reserve vide (mode edition) ; undefined = pas d'invite (diaporama, impression). */
  prompt?: (shape: Shape) => Paragraph[] | undefined;
  /** Valeurs des champs : numero de page, date. */
  fields: { slideNumber?: number; date?: Date };
}

const urls = new WeakMap<Uint8Array, string>();

/** Adresse objet (blob:) d'un media, mise en cache tant que ses octets vivent. */
export function mediaUrl(item: MediaItem | undefined): string | undefined {
  if (!item) return undefined;
  let url = urls.get(item.bytes);
  if (!url && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const copy = new Uint8Array(item.bytes);
    url = URL.createObjectURL(new Blob([copy.buffer], { type: item.contentType }));
    urls.set(item.bytes, url);
  }
  return url;
}

/** Les navigateurs n'affichent pas EMF / WMF / TIFF : ces images ont un rendu de remplacement. */
export function isRenderableImage(item: MediaItem | undefined): boolean {
  return !!item && /^image\/(png|jpe?g|gif|bmp|webp|svg\+xml|avif|x-icon|vnd\.microsoft\.icon)$/.test(item.contentType);
}

export const css = (ctx: PageContext, color: Color | undefined, placeholder?: Color): string | undefined => (color ? cssColor(color, ctx.theme, ctx.colorMap, placeholder) : undefined);

export function fontFamily(ctx: PageContext, font: string | undefined): string {
  const name = resolveThemeFont(font, ctx.theme) ?? ctx.theme.fonts.minor.latin;
  return fontStack(name || 'Aptos', ctx.theme);
}

/** Contexte d'une diapositive, d'une disposition ou d'un masque d'une presentation. */
export function deckPageContext(deck: Deck, owner: Slide | Layout | Master, options: { slideNumber?: number; prompts?: boolean } = {}): PageContext {
  const master = 'layoutId' in owner ? (findLayout(deck, owner.layoutId)?.master ?? deck.masters[0]) : 'layouts' in owner ? owner : (deck.masters.find((m) => m.layouts.includes(owner)) ?? deck.masters[0]);
  if (!master) throw new Error('Presentation sans masque');
  const colorMap = 'layoutId' in owner ? effectiveColorMap(deck, owner) : (('colorMapOverride' in owner ? owner.colorMapOverride : undefined) ?? master.colorMap ?? DEFAULT_COLOR_MAP);
  const ctx: PageContext = {
    theme: master.theme,
    colorMap,
    resolve: (shape) => effectiveShape(deck, owner, shape),
    media: (id) => deck.media[id],
    fields: { slideNumber: options.slideNumber, date: new Date() },
  };
  if (options.prompts && 'layoutId' in owner) {
    ctx.prompt = (shape) => {
      const paragraphs = placeholderPrompt(deck, owner, shape);
      const type = shape.placeholder?.type;
      if (!paragraphs || !type || shapeChain(deck, owner, shape).layoutShape?.placeholder?.hasCustomPrompt) return paragraphs;
      const first = paragraphs[0];
      const text = S.canvas.prompts[type as keyof typeof S.canvas.prompts];
      if (!first || !text) return paragraphs;
      const props = first.runs[0]?.props ?? first.endProps ?? {};
      return [{ props: first.props, runs: [{ type: 'text', text, props }], endProps: props }];
    };
  }
  return ctx;
}

/** Arriere-plan effectif d'une page de presentation. */
export function deckPageBackground(deck: Deck, owner: Slide | Layout | Master): Fill {
  return effectiveBackground(deck, owner);
}
