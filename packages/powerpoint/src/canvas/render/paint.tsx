// Remplissages, contours et effets DrawingML vers SVG / CSS.
import type { CSSProperties, ReactNode } from 'react';
import type { Color, Effects, Fill, Line, LineEnd } from '@forgeoffice/pptx';
import { css, isRenderableImage, mediaUrl, type PageContext } from '../context.ts';
import { DASHES } from './dashes.ts';

export interface Paint {
  /** Valeur de l'attribut fill / stroke (couleur ou url(#id)). */
  value: string;
  defs: ReactNode[];
}

const NONE: Paint = { value: 'none', defs: [] };

/** Motifs predefinis : trace d'une tuile 8x8 (traits du premier plan). */
const PATTERNS: Readonly<Record<string, string>> = {
  horz: 'M0 4H8', ltHorz: 'M0 2H8M0 6H8', dkHorz: 'M0 1H8M0 3H8M0 5H8M0 7H8', narHorz: 'M0 2H8M0 6H8',
  vert: 'M4 0V8', ltVert: 'M2 0V8M6 0V8', dkVert: 'M1 0V8M3 0V8M5 0V8M7 0V8', narVert: 'M2 0V8M6 0V8',
  dnDiag: 'M0 0L8 8', ltDnDiag: 'M0 0L8 8M-4 4L4 12M4 -4L12 4', dkDnDiag: 'M0 0L8 8M-2 2L6 10M2 -2L10 6', wdDnDiag: 'M0 0L8 8',
  upDiag: 'M0 8L8 0', ltUpDiag: 'M0 8L8 0M-4 4L4 -4M4 12L12 4', dkUpDiag: 'M0 8L8 0M-2 6L6 -2M2 10L10 2', wdUpDiag: 'M0 8L8 0',
  cross: 'M4 0V8M0 4H8', smGrid: 'M2 0V8M6 0V8M0 2H8M0 6H8', lgGrid: 'M0 0V8M0 0H8', diagCross: 'M0 0L8 8M0 8L8 0',
  smCheck: 'M0 0h4v4h-4zM4 4h4v4h-4z', lgCheck: 'M0 0h4v4h-4zM4 4h4v4h-4z', dotGrid: 'M0 0h1v1h-1z', dotDmnd: 'M0 0h1v1h-1zM4 4h1v1h-1z',
  pct5: 'M0 0h1v1h-1z', pct10: 'M0 0h1v1h-1zM4 4h1v1h-1z', pct20: 'M0 0h1v1h-1zM4 4h1v1h-1zM4 0h1v1h-1zM0 4h1v1h-1z',
  pct25: 'M0 0h2v2h-2zM4 4h2v2h-2z', pct30: 'M0 0h2v2h-2zM4 4h2v2h-2zM4 0h2v2h-2z', pct40: 'M0 0h2v2h-2zM4 4h2v2h-2zM4 0h2v2h-2zM0 4h2v2h-2z',
  pct50: 'M0 0h4v4h-4zM4 4h4v4h-4z', pct60: 'M0 0h6v6h-6zM4 4h4v4h-4z', pct70: 'M0 0h7v7h-7z', pct75: 'M0 0h7v7h-7z', pct80: 'M0 0h8v7h-8z', pct90: 'M0 0h8v8h-8z',
};

/** Peinture SVG d'un remplissage. `id` doit etre unique dans le document (prefixe des definitions). */
export function fillPaint(fill: Fill | undefined, ctx: PageContext, id: string, groupFill?: Fill): Paint {
  if (!fill) return NONE;
  switch (fill.type) {
    case 'none':
      return NONE;
    case 'group':
      return groupFill && groupFill.type !== 'group' ? fillPaint(groupFill, ctx, id) : NONE;
    case 'solid':
      return { value: css(ctx, fill.color) ?? 'none', defs: [] };
    case 'gradient': {
      const stops = [...fill.stops].sort((a, b) => a.position - b.position).map((s, i) => <stop key={i} offset={`${s.position}%`} stopColor={css(ctx, s.color)} />);
      if (fill.kind === 'linear') {
        const a = ((fill.angle ?? 0) * Math.PI) / 180;
        const dx = Math.cos(a) / 2;
        const dy = Math.sin(a) / 2;
        return {
          value: `url(#${id})`,
          defs: [
            <linearGradient key={id} id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
              {stops}
            </linearGradient>,
          ],
        };
      }
      const f = fill.focus ?? { left: 50, top: 50, right: 50, bottom: 50 };
      const cx = (f.left + (100 - f.right)) / 200;
      const cy = (f.top + (100 - f.bottom)) / 200;
      return {
        value: `url(#${id})`,
        defs: [
          <radialGradient key={id} id={id} cx={cx} cy={cy} r={fill.kind === 'circle' ? 0.71 : 0.75} fx={cx} fy={cy}>
            {stops}
          </radialGradient>,
        ],
      };
    }
    case 'pattern': {
      const fg = css(ctx, fill.foreground) ?? '#000';
      const bg = css(ctx, fill.background) ?? '#fff';
      const d = PATTERNS[fill.preset] ?? PATTERNS.pct50 ?? '';
      const filled = d.includes('z');
      return {
        value: `url(#${id})`,
        defs: [
          <pattern key={id} id={id} width={8} height={8} patternUnits="userSpaceOnUse">
            <rect width={8} height={8} fill={bg} />
            <path d={d} fill={filled ? fg : 'none'} stroke={filled ? 'none' : fg} strokeWidth={1} />
          </pattern>,
        ],
      };
    }
    case 'image': {
      const item = ctx.media(fill.mediaId);
      const href = isRenderableImage(item) ? mediaUrl(item) : undefined;
      if (!href) return { value: '#D9D9D9', defs: [] };
      if (fill.mode === 'tile' && fill.tile) {
        return {
          value: `url(#${id})`,
          defs: [
            <pattern key={id} id={id} width={64 * (fill.tile.sx / 100 || 1)} height={64 * (fill.tile.sy / 100 || 1)} patternUnits="userSpaceOnUse">
              <image href={href} width={64 * (fill.tile.sx / 100 || 1)} height={64 * (fill.tile.sy / 100 || 1)} opacity={fill.alpha === undefined ? undefined : fill.alpha / 100} />
            </pattern>,
          ],
        };
      }
      return {
        value: `url(#${id})`,
        defs: [
          <pattern key={id} id={id} width={1} height={1} patternContentUnits="objectBoundingBox">
            <image href={href} width={1} height={1} preserveAspectRatio="none" opacity={fill.alpha === undefined ? undefined : fill.alpha / 100} />
          </pattern>,
        ],
      };
    }
  }
}

/** Arriere-plan de page en CSS. */
export function backgroundCss(fill: Fill | undefined, ctx: PageContext): CSSProperties {
  if (!fill || fill.type === 'none' || fill.type === 'group') return { background: '#FFFFFF' };
  if (fill.type === 'solid') return { background: css(ctx, fill.color) };
  if (fill.type === 'gradient') {
    const stops = [...fill.stops].sort((a, b) => a.position - b.position).map((s) => `${css(ctx, s.color)} ${s.position}%`).join(', ');
    return fill.kind === 'linear' ? { background: `linear-gradient(${(fill.angle ?? 0) + 90}deg, ${stops})` } : { background: `radial-gradient(circle, ${stops})` };
  }
  if (fill.type === 'pattern') return { background: css(ctx, fill.background) };
  const item = ctx.media(fill.mediaId);
  const href = isRenderableImage(item) ? mediaUrl(item) : undefined;
  if (!href) return { background: '#FFFFFF' };
  return fill.mode === 'tile'
    ? { backgroundImage: `url("${href}")`, backgroundRepeat: 'repeat' }
    : { backgroundImage: `url("${href}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' };
}

export interface Stroke {
  paint: Paint;
  width: number;
  dasharray?: string;
  linecap: 'butt' | 'round' | 'square';
  linejoin: 'round' | 'bevel' | 'miter';
}

/** Contour SVG ; null s'il n'y a pas de trait. */
export function strokeOf(line: Line | undefined, ctx: PageContext, id: string): Stroke | null {
  if (!line?.fill || line.fill.type === 'none') return null;
  const paint = fillPaint(line.fill, ctx, id);
  if (paint.value === 'none') return null;
  const width = line.width ?? 0.75;
  const pattern = line.customDash?.flatMap((d) => [d.dash / 100, d.space / 100]) ?? (line.dash ? DASHES[line.dash] : undefined);
  const cap = line.cap === 'rnd' ? 'round' : line.cap === 'sq' ? 'square' : 'butt';
  return {
    paint,
    width,
    dasharray: pattern?.map((v) => Math.max(0.1, v * width)).join(' '),
    linecap: pattern && cap === 'butt' && line.dash?.includes('Dot') ? 'butt' : cap,
    linejoin: line.join ?? 'round',
  };
}

const END_SIZE: Readonly<Record<string, number>> = { sm: 2, med: 3, lg: 5 };

/** Marqueur de bout de ligne (fleche, triangle, losange, ovale). */
export function lineEndMarker(end: LineEnd | undefined, color: string, lineWidth: number, id: string, atStart: boolean): ReactNode {
  if (!end || end.type === 'none') return null;
  const w = END_SIZE[end.width ?? 'med'] ?? 3;
  const l = END_SIZE[end.length ?? 'med'] ?? 3;
  const scale = Math.max(1, lineWidth);
  const shape = (() => {
    switch (end.type) {
      case 'triangle':
        return <path d={`M0 0L${l} ${w / 2}L0 ${w}Z`} fill={color} />;
      case 'stealth':
        return <path d={`M0 0L${l} ${w / 2}L0 ${w}L${l * 0.35} ${w / 2}Z`} fill={color} />;
      case 'arrow':
        return <path d={`M0 0L${l} ${w / 2}L0 ${w}`} fill="none" stroke={color} strokeWidth={0.6} />;
      case 'diamond':
        return <path d={`M0 ${w / 2}L${l / 2} 0L${l} ${w / 2}L${l / 2} ${w}Z`} fill={color} />;
      case 'oval':
        return <ellipse cx={l / 2} cy={w / 2} rx={l / 2} ry={w / 2} fill={color} />;
      default:
        return null;
    }
  })();
  const refX = end.type === 'diamond' || end.type === 'oval' ? l / 2 : l * 0.9;
  return (
    <marker key={id} id={id} viewBox={`-1 -1 ${l + 2} ${w + 2}`} markerWidth={(l + 2) * scale} markerHeight={(w + 2) * scale} markerUnits="userSpaceOnUse" refX={refX} refY={w / 2} orient={atStart ? 'auto-start-reverse' : 'auto'}>
      {shape}
    </marker>
  );
}

const shadowCss = (ctx: PageContext, color: Color, blur: number, distance: number, direction: number): string => {
  const a = (direction * Math.PI) / 180;
  return `drop-shadow(${(Math.cos(a) * distance).toFixed(2)}px ${(Math.sin(a) * distance).toFixed(2)}px ${(blur / 2).toFixed(2)}px ${css(ctx, color) ?? '#0006'})`;
};

/** Effets (ombre exterieure, lumiere, contours adoucis, flou, reflet) en CSS appliques au conteneur de la forme. */
export function effectsCss(effects: Effects | undefined, ctx: PageContext): CSSProperties {
  if (!effects) return {};
  const filters: string[] = [];
  if (effects.glow) filters.push(`drop-shadow(0 0 ${effects.glow.radius / 2}px ${css(ctx, effects.glow.color)})`, `drop-shadow(0 0 ${effects.glow.radius / 3}px ${css(ctx, effects.glow.color)})`);
  if (effects.outerShadow) filters.push(shadowCss(ctx, effects.outerShadow.color, effects.outerShadow.blur, effects.outerShadow.distance, effects.outerShadow.direction));
  if (effects.presetShadow) filters.push(shadowCss(ctx, effects.presetShadow.color, 4, effects.presetShadow.distance, effects.presetShadow.direction));
  if (effects.blur) filters.push(`blur(${effects.blur.radius / 2}px)`);
  const out: CSSProperties = {};
  if (filters.length) out.filter = filters.join(' ');
  if (effects.softEdge) out.maskImage = `radial-gradient(closest-side, #000 ${Math.max(0, 100 - effects.softEdge * 2)}%, transparent)`;
  if (effects.reflection) {
    const r = effects.reflection;
    const reflect = `below ${r.distance}px linear-gradient(transparent ${100 - r.endPosition}%, rgba(0,0,0,${(r.startAlpha / 100).toFixed(2)}))`;
    (out as Record<string, string>).WebkitBoxReflect = reflect;
  }
  return out;
}

/** Ombre de texte equivalente aux effets d'un segment. */
export function textShadowCss(effects: Effects | undefined, ctx: PageContext): string | undefined {
  if (!effects) return undefined;
  const parts: string[] = [];
  if (effects.outerShadow) {
    const s = effects.outerShadow;
    const a = (s.direction * Math.PI) / 180;
    parts.push(`${(Math.cos(a) * s.distance).toFixed(2)}px ${(Math.sin(a) * s.distance).toFixed(2)}px ${s.blur / 2}px ${css(ctx, s.color)}`);
  }
  if (effects.glow) parts.push(`0 0 ${effects.glow.radius}px ${css(ctx, effects.glow.color)}`);
  return parts.length ? parts.join(', ') : undefined;
}

/** Noms des motifs predefinis disponibles (volet Format). */
export const PATTERN_NAMES: readonly string[] = Object.keys(PATTERNS);
