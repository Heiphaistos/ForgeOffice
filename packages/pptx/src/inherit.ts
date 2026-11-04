// Heritage des espaces reserves (diapositive -> disposition -> masque) et des styles de theme.
import type { Color, Effects, Fill, Line, ListStyle, Paragraph, ParagraphProps, RunProps, ShapeStyle, TextBody, BodyProps } from './dml.ts';
import type { Background, ColorMap, Deck, Layout, Master, Placeholder, PlaceholderType, Shape, Slide, Theme } from './model.ts';
import { findLayout } from './model.ts';
import { resolveThemeFont } from './theme.ts';

export interface ShapeChain {
  master: Master;
  layout?: Layout;
  /** Espace reserve correspondant dans la disposition. */
  layoutShape?: Shape;
  /** Espace reserve correspondant dans le masque. */
  masterShape?: Shape;
}

const TITLE_TYPES = new Set<PlaceholderType>(['title', 'ctrTitle']);
const OWN_TYPES = new Set<PlaceholderType>(['dt', 'ftr', 'sldNum', 'hdr']);

const isSlide = (owner: Slide | Layout | Master): owner is Slide => 'layoutId' in owner;
const isLayout = (owner: Slide | Layout | Master): owner is Layout => 'type' in owner && !('layouts' in owner);

/** Type du masque qui sert de base a un type d'espace reserve. */
export function masterPlaceholderType(type: PlaceholderType): PlaceholderType {
  if (TITLE_TYPES.has(type)) return 'title';
  if (OWN_TYPES.has(type)) return type;
  return 'body';
}

function sameFamily(a: PlaceholderType, b: PlaceholderType): boolean {
  return masterPlaceholderType(a) === masterPlaceholderType(b);
}

/** Espace reserve correspondant dans une liste (par indice, puis par type exact, puis par famille). */
export function matchPlaceholder(shapes: readonly Shape[], ph: Placeholder, toMaster = false): Shape | undefined {
  const candidates = shapes.filter((s) => s.placeholder);
  if (toMaster) {
    const wanted = masterPlaceholderType(ph.type);
    return candidates.find((s) => s.placeholder?.type === wanted) ?? candidates.find((s) => s.placeholder && masterPlaceholderType(s.placeholder.type) === wanted);
  }
  if (ph.index !== undefined && ph.index !== 0) {
    const byIndex = candidates.find((s) => s.placeholder?.index === ph.index);
    if (byIndex) return byIndex;
  }
  return (
    candidates.find((s) => s.placeholder?.type === ph.type && (TITLE_TYPES.has(ph.type) || OWN_TYPES.has(ph.type) || s.placeholder.index === ph.index)) ??
    candidates.find((s) => s.placeholder && TITLE_TYPES.has(ph.type) && TITLE_TYPES.has(s.placeholder.type)) ??
    candidates.find((s) => s.placeholder?.type === ph.type) ??
    (TITLE_TYPES.has(ph.type) || OWN_TYPES.has(ph.type) ? undefined : candidates.find((s) => s.placeholder && sameFamily(s.placeholder.type, ph.type) && !TITLE_TYPES.has(s.placeholder.type)))
  );
}

/** Masque et disposition d'un proprietaire (diapositive, disposition ou masque). */
export function ownerContext(deck: Deck, owner: Slide | Layout | Master): { master: Master; layout?: Layout } {
  if (isSlide(owner)) {
    const found = findLayout(deck, owner.layoutId);
    if (found) return found;
    const master = deck.masters[0];
    if (!master) throw new Error('Presentation sans masque');
    return { master, layout: master.layouts[0] };
  }
  if (isLayout(owner)) {
    const master = deck.masters.find((m) => m.layouts.includes(owner)) ?? deck.masters[0];
    if (!master) throw new Error('Presentation sans masque');
    return { master, layout: owner };
  }
  return { master: owner };
}

/** Chaine d'heritage d'une forme. */
export function shapeChain(deck: Deck, owner: Slide | Layout | Master, shape: Shape): ShapeChain {
  const { master, layout } = ownerContext(deck, owner);
  const chain: ShapeChain = { master, layout: isSlide(owner) ? layout : undefined };
  const ph = shape.placeholder;
  if (!ph || 'layouts' in owner) return chain;
  if (isSlide(owner) && layout) {
    chain.layoutShape = matchPlaceholder(layout.shapes, ph);
    chain.masterShape = matchPlaceholder(master.shapes, chain.layoutShape?.placeholder ?? ph, true);
  } else {
    chain.masterShape = matchPlaceholder(master.shapes, ph, true);
  }
  return chain;
}

// ---- Fusions ----

function mergeRun(base: RunProps | undefined, over: RunProps | undefined): RunProps {
  return { ...(base ?? {}), ...(over ?? {}) };
}

function mergeParagraph(base: ParagraphProps | undefined, over: ParagraphProps | undefined): ParagraphProps {
  const merged: ParagraphProps = { ...(base ?? {}), ...(over ?? {}) };
  if (base?.defaultRun || over?.defaultRun) merged.defaultRun = mergeRun(base?.defaultRun, over?.defaultRun);
  return merged;
}

/** Fusionne des styles de liste (le dernier l'emporte, niveau par niveau). */
export function mergeListStyles(...styles: Array<ListStyle | undefined>): ListStyle {
  const out: ListStyle = { levels: {} };
  for (const style of styles) {
    if (!style) continue;
    if (style.def) out.def = mergeParagraph(out.def, style.def);
    for (const [key, props] of Object.entries(style.levels)) {
      const level = Number(key);
      out.levels[level] = mergeParagraph(out.levels[level], props);
    }
  }
  return out;
}

function mergeBody(...bodies: Array<BodyProps | undefined>): BodyProps {
  const out: BodyProps = {};
  for (const body of bodies) {
    if (!body) continue;
    const insets = { ...(out.insets ?? {}), ...(body.insets ?? {}) };
    Object.assign(out, body);
    if (Object.keys(insets).length) out.insets = insets;
  }
  return out;
}

// ---- Styles de theme (p:style) ----

function substitute(color: Color, placeholder: Color | undefined): Color {
  if (color.type !== 'scheme' || color.value !== 'phClr' || !placeholder) return color;
  const mods = [...(placeholder.mods ?? []), ...(color.mods ?? [])];
  return mods.length ? { ...placeholder, mods } : { ...placeholder };
}

function substituteFill(fill: Fill, color: Color | undefined): Fill {
  switch (fill.type) {
    case 'solid':
      return { type: 'solid', color: substitute(fill.color, color) };
    case 'gradient':
      return { ...fill, stops: fill.stops.map((s) => ({ position: s.position, color: substitute(s.color, color) })) };
    case 'pattern':
      return { ...fill, foreground: substitute(fill.foreground, color), background: substitute(fill.background, color) };
    default:
      return { ...fill };
  }
}

/** Remplissage du theme designe par un index (1..3 = remplissages, 1001..1003 = arriere-plans). */
export function themeFill(theme: Theme, index: number, color?: Color): Fill | undefined {
  if (index <= 0) return undefined;
  const list = index >= 1000 ? theme.formatScheme.backgroundFills : theme.formatScheme.fills;
  const fill = list[(index >= 1000 ? index - 1000 : index) - 1] ?? list[list.length - 1];
  return fill ? substituteFill(fill, color) : undefined;
}

export function themeLine(theme: Theme, index: number, color?: Color): Line | undefined {
  if (index <= 0) return undefined;
  const line = theme.formatScheme.lines[index - 1] ?? theme.formatScheme.lines[theme.formatScheme.lines.length - 1];
  if (!line) return undefined;
  return line.fill ? { ...line, fill: substituteFill(line.fill, color) } : { ...line };
}

export function themeEffects(theme: Theme, index: number, color?: Color): Effects | undefined {
  if (index <= 0) return undefined;
  const effects = theme.formatScheme.effects[index - 1];
  if (!effects) return undefined;
  const out: Effects = { ...effects };
  if (out.outerShadow) out.outerShadow = { ...out.outerShadow, color: substitute(out.outerShadow.color, color) };
  if (out.innerShadow) out.innerShadow = { ...out.innerShadow, color: substitute(out.innerShadow.color, color) };
  if (out.glow) out.glow = { ...out.glow, color: substitute(out.glow.color, color) };
  return out;
}

function fontRefRun(style: ShapeStyle | undefined): RunProps | undefined {
  const font = style?.font;
  if (!font || font.index === 'none') return font?.color ? { color: font.color } : undefined;
  const prefix = font.index === 'major' ? '+mj' : '+mn';
  const run: RunProps = { font: `${prefix}-lt`, eastAsianFont: `${prefix}-ea`, complexFont: `${prefix}-cs` };
  if (font.color) run.color = font.color;
  return run;
}

// ---- Resolution ----

function baseListStyle(deck: Deck, master: Master, type: PlaceholderType | undefined): ListStyle {
  if (!type) return deck.defaultTextStyle;
  if (TITLE_TYPES.has(type)) return master.textStyles.title;
  if (OWN_TYPES.has(type)) return master.textStyles.other;
  return master.textStyles.body;
}

function resolveFonts(run: RunProps, theme: Theme): RunProps {
  const out = { ...run };
  if (out.font) out.font = resolveThemeFont(out.font, theme);
  if (out.eastAsianFont) out.eastAsianFont = resolveThemeFont(out.eastAsianFont, theme);
  if (out.complexFont) out.complexFont = resolveThemeFont(out.complexFont, theme);
  return out;
}

/** Proprietes completes d'un paragraphe et de ses segments d'apres un style de liste effectif. */
export function resolveParagraph(paragraph: Paragraph, listStyle: ListStyle, theme: Theme): Paragraph {
  const level = Math.max(0, Math.min(8, paragraph.props.level ?? 0));
  const props = mergeParagraph(mergeParagraph(listStyle.def, listStyle.levels[level]), paragraph.props);
  const defaults = props.defaultRun ?? {};
  const runs = paragraph.runs.map((run) => ({ ...run, props: resolveFonts(mergeRun(defaults, run.props), theme) }));
  const resolved: Paragraph = { props: { ...props, level, defaultRun: resolveFonts(defaults, theme) }, runs };
  resolved.endProps = resolveFonts(mergeRun(defaults, paragraph.endProps), theme);
  return resolved;
}

function textOf(shape: Shape | undefined): TextBody | undefined {
  return shape?.kind === 'shape' ? shape.text : undefined;
}

/**
 * Forme effective : position, geometrie, remplissage, contour, effets et texte herites de la disposition
 * et du masque, styles de theme appliques, polices de theme resolues. `owner` est la diapositive (ou la
 * disposition / le masque) qui porte la forme. La forme d'origine n'est pas modifiee.
 */
export function effectiveShape(deck: Deck, owner: Slide | Layout | Master, shape: Shape): Shape {
  const chain = shapeChain(deck, owner, shape);
  const theme = chain.master.theme;
  const out = structuredClone(shape);
  if (!out.xfrm) {
    const inherited = chain.layoutShape?.xfrm ?? chain.masterShape?.xfrm;
    if (inherited) out.xfrm = { ...inherited };
  }
  if (out.kind === 'group' || out.kind === 'table' || out.kind === 'chart' || out.kind === 'smartart' || out.kind === 'raw') return out;
  const parents = [chain.layoutShape, chain.masterShape];
  const style = 'style' in out ? out.style : undefined;
  const pick = <K extends 'fill' | 'line' | 'effects'>(key: K): unknown => {
    for (const parent of parents) {
      if (parent && parent.kind === out.kind && key in parent) {
        const value = (parent as unknown as Record<string, unknown>)[key];
        if (value !== undefined) return structuredClone(value);
      }
    }
    return undefined;
  };
  if (out.kind === 'shape') {
    out.fill ??= (pick('fill') as Fill | undefined) ?? (style?.fill ? themeFill(theme, style.fill.index, style.fill.color) : undefined);
  }
  if (out.kind === 'shape' || out.kind === 'picture' || out.kind === 'connector' || out.kind === 'media') {
    const themeLn = style?.line && (out.kind !== 'media') ? themeLine(theme, style.line.index, style.line.color) : undefined;
    const ownLine = out.line;
    const parentLine = pick('line') as Line | undefined;
    const resolvedLine = ownLine || parentLine || themeLn ? { ...(themeLn ?? {}), ...(parentLine ?? {}), ...(ownLine ?? {}) } : undefined;
    if (resolvedLine) out.line = resolvedLine;
    out.effects ??= (pick('effects') as Effects | undefined) ?? (style?.effect && out.kind !== 'media' ? themeEffects(theme, style.effect.index, style.effect.color) : undefined);
  }
  if (out.kind !== 'shape') return out;
  const own = out.text ?? { props: {}, paragraphs: [] };
  const layoutText = textOf(chain.layoutShape);
  const masterText = textOf(chain.masterShape);
  const listStyle = mergeListStyles(
    baseListStyle(deck, chain.master, shape.placeholder?.type),
    { levels: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, { defaultRun: fontRefRun(style) ?? {} }])) },
    masterText?.listStyle,
    layoutText?.listStyle,
    own.listStyle,
  );
  out.text = {
    props: mergeBody(masterText?.props, layoutText?.props, own.props),
    listStyle,
    paragraphs: own.paragraphs.map((p) => resolveParagraph(p, listStyle, theme)),
  };
  return out;
}

/** Texte d'invite a afficher dans un espace reserve vide (texte de la disposition). */
export function placeholderPrompt(deck: Deck, slide: Slide, shape: Shape): Paragraph[] | undefined {
  if (!shape.placeholder) return undefined;
  const chain = shapeChain(deck, slide, shape);
  const source = textOf(chain.layoutShape) ?? textOf(chain.masterShape);
  if (!source) return undefined;
  const effective = effectiveShape(deck, slide, { ...shape, kind: 'shape', geometry: { type: 'preset', preset: 'rect' }, text: { props: {}, paragraphs: source.paragraphs } } as Shape);
  return effective.kind === 'shape' ? effective.text?.paragraphs : undefined;
}

/** Correspondance de couleurs effective d'une diapositive. */
export function effectiveColorMap(deck: Deck, slide: Slide): ColorMap {
  const { master, layout } = ownerContext(deck, slide);
  return slide.colorMapOverride ?? layout?.colorMapOverride ?? master.colorMap;
}

/** Arriere-plan effectif (diapositive, sinon disposition, sinon masque), en remplissage concret. */
export function effectiveBackground(deck: Deck, owner: Slide | Layout | Master): Fill {
  const { master, layout } = ownerContext(deck, owner);
  const own = 'background' in owner ? (owner.background as Background | undefined) : undefined;
  const background = own ?? layout?.background ?? master.background;
  if (background.type === 'fill') return background.fill;
  return themeFill(master.theme, background.index, background.color) ?? { type: 'solid', color: background.color };
}

/** Formes non reservees du masque et de la disposition dessinees derriere la diapositive. */
export function backgroundShapes(deck: Deck, slide: Slide): Shape[] {
  const { master, layout } = ownerContext(deck, slide);
  if (slide.showMasterShapes === false) return [];
  const own = (shapes: Shape[]): Shape[] => shapes.filter((s) => !s.placeholder);
  const fromMaster = layout?.showMasterShapes === false ? [] : own(master.shapes);
  return [...fromMaster, ...own(layout?.shapes ?? [])];
}
