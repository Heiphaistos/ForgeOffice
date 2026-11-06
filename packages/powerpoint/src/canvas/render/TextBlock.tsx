// Rendu HTML du texte d'une forme (paragraphes, puces, numerotation, champs, ajustement automatique).
// Les paragraphes portent data-p et les segments data-o (decalage) : l'editeur de texte s'en sert pour les positions.
import { useFontsEpoch } from '@forgeoffice/ui';
import { Fragment, useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import type { BodyProps, Paragraph, ParagraphProps, Run, RunProps, Spacing, TextBody } from '@forgeoffice/pptx';
import { css, fontFamily, mediaUrl, type PageContext, type WrapFloat } from '../context.ts';
import type { Rect } from '../math.ts';
import { textShadowCss } from './paint.tsx';
import { DEFAULT_INSETS, autoNumberLabel, formatField, paragraphNumbers, symbolChar } from './numbering.ts';

export { DEFAULT_INSETS, autoNumberLabel, paragraphNumbers };

const DEFAULT_SIZE = 18;

const ALIGN: Readonly<Record<string, CSSProperties['textAlign']>> = { l: 'left', ctr: 'center', r: 'right', just: 'justify', justLow: 'justify', dist: 'justify', thaiDist: 'justify' };
const ANCHOR: Readonly<Record<string, CSSProperties['justifyContent']>> = { t: 'flex-start', ctr: 'center', b: 'flex-end', just: 'space-between', dist: 'space-around' };

const spacingPx = (s: Spacing | undefined, size: number): number | undefined => (!s ? undefined : s.type === 'pts' ? s.value : (s.value / 100) * size * 1.2);

/** Style CSS d'un segment. */
export function runStyle(props: RunProps, ctx: PageContext): CSSProperties {
  const size = props.size ?? DEFAULT_SIZE;
  const st: CSSProperties = {
    fontFamily: fontFamily(ctx, props.font),
    fontSize: `calc(${size}px * var(--fo-fs, 1))`,
    fontWeight: props.bold ? 700 : 400,
    fontStyle: props.italic ? 'italic' : 'normal',
  };
  const deco: string[] = [];
  if (props.underline && props.underline !== 'none') deco.push('underline');
  if (props.strike && props.strike !== 'noStrike') deco.push('line-through');
  if (props.link?.url || props.link?.slideId !== undefined || props.link?.action) deco.push('underline');
  if (deco.length) {
    st.textDecorationLine = [...new Set(deco)].join(' ');
    if (props.underline === 'dbl' || props.strike === 'dblStrike') st.textDecorationStyle = 'double';
    else if (props.underline?.startsWith('dot')) st.textDecorationStyle = 'dotted';
    else if (props.underline?.startsWith('dash')) st.textDecorationStyle = 'dashed';
    else if (props.underline?.startsWith('wavy')) st.textDecorationStyle = 'wavy';
    if (props.underlineColor) st.textDecorationColor = css(ctx, props.underlineColor);
  }
  const linkColor = props.link ? css(ctx, { type: 'scheme', value: 'hlink' }) : undefined;
  if (props.textFill && props.textFill.type === 'gradient') {
    const stops = props.textFill.stops.map((s) => `${css(ctx, s.color)} ${s.position}%`).join(', ');
    st.backgroundImage = `linear-gradient(${(props.textFill.angle ?? 0) + 90}deg, ${stops})`;
    st.backgroundClip = 'text';
    st.WebkitBackgroundClip = 'text';
    st.color = 'transparent';
  } else if (props.textFill?.type === 'none') st.color = 'transparent';
  else if (props.textFill?.type === 'solid') st.color = css(ctx, props.textFill.color);
  else st.color = linkColor ?? css(ctx, props.color) ?? css(ctx, { type: 'scheme', value: 'tx1' });
  if (props.highlight) st.backgroundColor = css(ctx, props.highlight);
  if (props.caps === 'all') st.textTransform = 'uppercase';
  if (props.caps === 'small') st.fontVariant = 'small-caps';
  if (props.spacing) st.letterSpacing = `${props.spacing}px`;
  if (props.baseline) {
    st.verticalAlign = `${props.baseline > 0 ? 0.33 : -0.15}em`;
    st.fontSize = `calc(${size * 0.67}px * var(--fo-fs, 1))`;
  }
  if (props.outline?.fill && props.outline.fill.type === 'solid') {
    st.WebkitTextStroke = `${props.outline.width ?? 0.75}px ${css(ctx, props.outline.fill.color)}`;
  }
  const shadow = textShadowCss(props.effects, ctx);
  if (shadow) st.textShadow = shadow;
  if (props.rtl) st.direction = 'rtl';
  return st;
}

function bulletNode(p: Paragraph, number: number | null, ctx: PageContext, firstRun: RunProps): ReactNode {
  const bullet = p.props.bullet;
  if (!bullet || bullet.type === 'none') return null;
  const size = firstRun.size ?? DEFAULT_SIZE;
  const st: CSSProperties = { ...runStyle(firstRun, ctx), display: 'inline-block', textIndent: 0, fontWeight: 400, fontStyle: 'normal', textDecorationLine: 'none' };
  const indent = p.props.indent ?? 0;
  st.minWidth = indent < 0 ? -indent : undefined;
  st.paddingRight = indent < 0 ? 0 : '0.4em';
  if (p.props.bulletColor && p.props.bulletColor !== 'text') st.color = css(ctx, p.props.bulletColor);
  const bs = p.props.bulletSize;
  if (bs && bs.type !== 'text') st.fontSize = `calc(${bs.type === 'pct' ? (size * bs.value) / 100 : bs.value}px * var(--fo-fs, 1))`;
  if (p.props.bulletFont && p.props.bulletFont !== 'text') st.fontFamily = fontFamily(ctx, p.props.bulletFont);
  if (bullet.type === 'image') {
    const url = mediaUrl(ctx.media(bullet.mediaId));
    return url ? (
      <span contentEditable={false} style={st} data-bullet="">
        <img src={url} alt="" style={{ width: '0.8em', height: '0.8em' }} />
      </span>
    ) : null;
  }
  const label = bullet.type === 'char' ? symbolChar(bullet.char, p.props.bulletFont) : autoNumberLabel(bullet.scheme, number ?? 1);
  return (
    <span contentEditable={false} style={st} data-bullet="">
      {label}
    </span>
  );
}

function paragraphStyle(props: ParagraphProps, size: number, scale: number): CSSProperties {
  const line = props.lineSpacing;
  const st: CSSProperties = {
    textAlign: ALIGN[props.align ?? 'l'] ?? 'left',
    paddingLeft: props.marginLeft ?? 0,
    paddingRight: props.marginRight ?? 0,
    textIndent: props.indent ?? 0,
    lineHeight: line?.type === 'pts' ? `${line.value}px` : `${((line?.value ?? 100) / 100) * 1.2 * scale}`,
    position: 'relative',
    overflowWrap: 'break-word',
  };
  st.marginTop = spacingPx(props.spaceBefore, size);
  st.marginBottom = spacingPx(props.spaceAfter, size);
  if (props.rtl) st.direction = 'rtl';
  if (props.align === 'dist') st.textAlignLast = 'justify';
  return st;
}

export interface TextBlockProps {
  body: TextBody;
  ctx: PageContext;
  /** Zone de texte (repere local de la forme). */
  rect: Rect;
  /** Texte d'invite affiche en gris quand le corps est vide (espaces reserves). */
  prompt?: Paragraph[];
  /** Attributs de la zone de saisie (editeur de texte). */
  flowProps?: HTMLAttributes<HTMLDivElement>;
  flowRef?: Ref<HTMLDivElement>;
  /** Vrai pendant l'edition : pas de reduction automatique (la taille suit la frappe). */
  editing?: boolean;
  className?: string;
  /** Dans le flux (cellule de tableau) : la hauteur suit le texte, `rect.height` sert de minimum. */
  inline?: boolean;
  flowKey?: number;
  /** Objets contournes par le texte (flottants invisibles places avant le premier paragraphe). */
  wrapFloats?: readonly WrapFloat[];
}

const isEmptyBody = (body: TextBody): boolean => body.paragraphs.every((p) => p.runs.every((r) => r.type === 'text' && r.text === ''));

/** Bloc de texte positionne dans la forme. */
export function TextBlock({ body, ctx, rect, prompt, flowProps, flowRef, editing = false, className, inline = false, flowKey, wrapFloats }: TextBlockProps) {
  const props: BodyProps = body.props;
  const insets = { ...DEFAULT_INSETS, ...(props.insets ?? {}) };
  const innerRef = useRef<HTMLDivElement | null>(null);
  useFontsEpoch(); // l'ajustement automatique se refait quand les polices (Calibri, Arial...) sont chargees
  const showPrompt = !!prompt && isEmptyBody(body) && !editing;
  const paragraphs = showPrompt ? (prompt ?? []) : body.paragraphs;
  const autofit = props.autofit;
  const fileScale = autofit?.type === 'normal' ? (autofit.fontScale ?? 100) / 100 : 1;
  const lineScale = autofit?.type === 'normal' ? 1 - (autofit.lineSpacingReduction ?? 0) / 100 : 1;
  const numbers = paragraphNumbers(paragraphs);
  const vertical = props.vertical && props.vertical !== 'horz';

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty('--fo-fs', String(fileScale));
    if (autofit?.type !== 'normal' || editing) return;
    const avail = rect.height - insets.top - insets.bottom;
    let scale = fileScale;
    for (let i = 0; i < 6 && avail > 0; i++) {
      const used = el.scrollHeight;
      if (used <= avail + 0.5 || scale <= 0.25) break;
      scale = Math.max(0.25, scale * Math.max(0.5, (avail / used) * 0.97));
      el.style.setProperty('--fo-fs', String(scale));
    }
  });

  const outer: CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: ANCHOR[props.anchor ?? 't'] ?? 'flex-start',
    padding: `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px`,
    boxSizing: 'border-box',
    overflow: props.vertOverflow === 'clip' ? 'hidden' : 'visible',
    pointerEvents: editing ? 'auto' : 'none',
  };
  if (inline) {
    outer.position = 'relative';
    outer.left = undefined;
    outer.top = undefined;
    outer.height = undefined;
    outer.minHeight = rect.height;
  }
  if (vertical) {
    outer.writingMode = 'vertical-rl';
    if (props.vertical === 'vert270') outer.transform = 'rotate(180deg)';
    if (props.vertical === 'eaVert') outer.textOrientation = 'upright';
  }
  const flowStyle: CSSProperties = {
    outline: 'none',
    whiteSpace: props.wrap === false ? 'pre' : 'pre-wrap',
    alignSelf: props.anchorCenter ? 'center' : 'stretch',
    minHeight: editing ? '1em' : undefined,
    cursor: editing ? 'text' : undefined,
    userSelect: editing ? 'text' : 'none',
    WebkitUserSelect: editing ? 'text' : 'none',
    caretColor: editing ? 'auto' : undefined,
  };
  if (props.columns && props.columns > 1) {
    flowStyle.columnCount = props.columns;
    flowStyle.columnGap = props.columnSpacing ?? 0;
    flowStyle.height = '100%';
  }
  return (
    <div className={className} style={outer} data-text-box="">
      <div
        key={flowKey}
        {...flowProps}
        ref={(el) => {
          innerRef.current = el;
          if (typeof flowRef === 'function') flowRef(el);
          else if (flowRef) (flowRef as { current: HTMLDivElement | null }).current = el;
        }}
        style={flowStyle}
        data-text-flow=""
      >
        {wrapFloats?.map((f, i) => (
          <Fragment key={`w${i}`}>
            {f.before > 0 && <div data-wrap="" aria-hidden contentEditable={false} style={{ float: f.side, clear: f.side, width: 0, height: f.before }} />}
            <div data-wrap="" aria-hidden contentEditable={false} style={{ float: f.side, clear: f.side, width: f.width, height: f.height, shapeOutside: f.polygon }} />
          </Fragment>
        ))}
        {paragraphs.map((p, i) => {
          const first = p.runs[0]?.props ?? p.endProps ?? p.props.defaultRun ?? {};
          const size = first.size ?? DEFAULT_SIZE;
          let offset = 0;
          const runs = p.runs.map((run, j) => {
            const at = offset;
            offset += run.type === 'break' ? 1 : run.text.length;
            const st = runStyle(run.props, ctx);
            if (run.type === 'break') return <br key={j} data-o={at} data-len={1} />;
            if (run.type === 'field') {
              return (
                <span key={j} style={st} data-o={at} data-len={run.text.length} data-field="" contentEditable={false}>
                  {formatField(run, ctx)}
                </span>
              );
            }
            return (
              <span key={j} style={st} data-o={at}>
                {run.text}
              </span>
            );
          });
          const end = p.endProps ?? first;
          return (
            <div key={i} data-p={i} style={{ ...paragraphStyle(p.props, size, lineScale), fontSize: `calc(${end.size ?? size}px * var(--fo-fs, 1))`, fontFamily: fontFamily(ctx, end.font ?? first.font) }}>
              {p.runs.length > 0 || showPrompt ? bulletNode(p, numbers[i] ?? null, ctx, first) : null}
              {runs}
              {offset === 0 || p.runs[p.runs.length - 1]?.type === 'break' ? <br data-end="" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
