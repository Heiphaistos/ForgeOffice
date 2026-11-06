// Styles du PDF : couleurs resolues, style d'un segment, puces et champs, a partir du contexte de page.
import { resolveColor, resolveThemeFont, type Color, type Paragraph, type Run, type RunProps } from '@forgeoffice/pptx';
import { fontFamily, type PageContext } from '../canvas/context.ts';
import { autoNumberLabel, formatField, paragraphNumbers, symbolChar } from '../canvas/render/numbering.ts';
import { familyOf } from './fonts.ts';
import type { LayoutEnv, Rgb, SegStyle } from './text-layout.ts';
import type { FontBook } from './fonts.ts';

const DEFAULT_SIZE = 18;
export const BLACK: Rgb = [0, 0, 0];

export interface Painted {
  rgb: Rgb;
  alpha: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Couleur du modele resolue avec le theme de la page. */
export function paintOf(color: Color | undefined, ctx: PageContext): Painted | undefined {
  if (!color) return undefined;
  const { hex, alpha } = resolveColor(color, ctx.theme, ctx.colorMap);
  return { rgb: hexToRgb(hex), alpha };
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Style resolu d'un segment de texte. */
export function segStyle(props: RunProps, scale: number, ctx: PageContext): SegStyle {
  const base = (props.size ?? DEFAULT_SIZE) * scale;
  const sup = props.baseline ?? 0;
  const size = sup ? base * 0.67 : base;
  const family = fontFamily(ctx, props.font);
  const bold = !!props.bold;
  const italic = !!props.italic;
  const link = props.link?.url ?? undefined;
  const hasLink = !!(props.link && (props.link.url || props.link.slideId !== undefined || props.link.action));
  const fillColor = props.textFill?.type === 'solid' ? props.textFill.color : props.textFill?.type === 'gradient' ? props.textFill.stops[0]?.color : undefined;
  const painted =
    props.textFill?.type === 'none'
      ? { rgb: BLACK, alpha: 0 }
      : paintOf(hasLink ? { type: 'scheme', value: 'hlink' } : (fillColor ?? props.color ?? { type: 'scheme', value: 'tx1' }), ctx) ?? { rgb: BLACK, alpha: 1 };
  const outline = props.outline?.fill?.type === 'solid' ? paintOf(props.outline.fill.color, ctx) : undefined;
  return {
    font: { family: familyOf(resolveThemeFont(props.font, ctx.theme) ?? ctx.theme.fonts.minor.latin), bold, italic },
    size,
    color: painted.rgb,
    alpha: painted.alpha,
    underline: (!!props.underline && props.underline !== 'none') || hasLink,
    strike: !!props.strike && props.strike !== 'noStrike',
    highlight: paintOf(props.highlight, ctx)?.rgb,
    rise: sup ? (sup > 0 ? 0.33 : -0.15) * size : 0,
    spacing: props.spacing ?? 0,
    outline: outline ? { color: outline.rgb, width: props.outline?.width ?? 0.75 } : undefined,
    link,
    css: `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${size}px ${family}`,
  };
}

/** Environnement de mise en page d'une forme (styles, champs, puces). */
export function layoutEnv(book: FontBook, ctx: PageContext, paragraphs: readonly Paragraph[], screen?: (text: string, css: string) => number): LayoutEnv {
  return {
    book,
    screen,
    numbers: paragraphNumbers(paragraphs),
    style: (props, scale) => segStyle(props, scale, ctx),
    field: (run: Extract<Run, { type: 'field' }>) => formatField(run, ctx),
    bullet: (p, number, base, scale) => {
      const bullet = p.props.bullet;
      if (!bullet || bullet.type === 'none' || bullet.type === 'image') return null;
      const text = bullet.type === 'char' ? symbolChar(bullet.char, p.props.bulletFont) : autoNumberLabel(bullet.scheme, number ?? 1);
      const style: SegStyle = { ...base, font: { ...base.font, bold: false, italic: false }, underline: false, strike: false, highlight: undefined, link: undefined, outline: undefined };
      if (p.props.bulletColor && p.props.bulletColor !== 'text') {
        const c = paintOf(p.props.bulletColor, ctx);
        if (c) [style.color, style.alpha] = [c.rgb, c.alpha];
      }
      const bs = p.props.bulletSize;
      if (bs && bs.type !== 'text') style.size = (bs.type === 'pct' ? (base.size * bs.value) / 100 : bs.value) * (bs.type === 'pts' ? scale : 1);
      if (p.props.bulletFont && p.props.bulletFont !== 'text' && !/wingdings|symbol/i.test(p.props.bulletFont)) style.font = { ...style.font, family: familyOf(p.props.bulletFont) };
      style.css = `400 ${style.size}px ${fontFamily(ctx, p.props.bulletFont && p.props.bulletFont !== 'text' ? p.props.bulletFont : undefined)}`;
      return { text, style };
    },
  };
}
