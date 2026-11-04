// Lecture DrawingML (a:*) vers le modele : couleurs, remplissages, contours, effets, geometrie, texte.
import { attr, child, children, isElement, numAttr, textOf, type XmlElement } from '@forgeoffice/opc';
import type {
  Autofit,
  BodyProps,
  Bullet,
  Color,
  ColorMod,
  Effects,
  Fill,
  Geometry,
  GeometryGuide,
  GeometryPath,
  Hyperlink,
  Insets,
  Line,
  LineEnd,
  ListStyle,
  Paragraph,
  ParagraphProps,
  PathCommand,
  PathPoint,
  PathValue,
  RunProps,
  SchemeColorName,
  ShapeStyle,
  Spacing,
  TextBody,
  Transform,
} from './dml.ts';
import { cloneXml } from './xmlns.ts';
import { angleToDeg, emuToPt, ooPctToPct } from './units.ts';

/** Ce dont la lecture a besoin pour resoudre les relations de la partie courante. */
export interface DmlReadContext {
  /** Identifiant de media (deck.media) pour une relation d'image ; undefined si absente. */
  media(relId: string): string | undefined;
  /** Lien hypertexte d'une relation. */
  hyperlink(relId: string): Pick<Hyperlink, 'url' | 'slideId'> | undefined;
}

const UNSAFE_SCHEME = /^\s*(javascript|vbscript|data|livescript)\s*:/i;

/** Refuse les schemas dangereux (javascript:, vbscript:, data:). */
export function safeUrl(url: string): string | undefined {
  const cleaned = url.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return UNSAFE_SCHEME.test(cleaned) ? undefined : cleaned;
}

const emu = (element: XmlElement | undefined, name: string): number | undefined => {
  const value = numAttr(element, name);
  return value === undefined ? undefined : emuToPt(value);
};

const pct = (element: XmlElement | undefined, name: string): number | undefined => {
  const value = numAttr(element, name);
  return value === undefined ? undefined : ooPctToPct(value);
};

export const bool = (element: XmlElement | undefined, name: string): boolean | undefined => {
  const raw = attr(element, name);
  return raw === undefined ? undefined : raw === '1' || raw === 'true';
};

// ---- Couleurs ----

const COLOR_TAGS = new Set(['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr', 'a:hslClr', 'a:scrgbClr']);

function readMods(node: XmlElement): ColorMod[] | undefined {
  const mods = children(node).map((m) => {
    const val = numAttr(m, 'val');
    return val === undefined ? { name: m.name.slice(2) } : { name: m.name.slice(2), val };
  });
  return mods.length ? mods : undefined;
}

function hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

function hslToRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return hex((r + m) * 255) + hex((g + m) * 255) + hex((b + m) * 255);
}

/** Lit l'element couleur lui-meme (a:srgbClr...). */
export function readColorElement(node: XmlElement): Color | undefined {
  const mods = readMods(node);
  const withMods = <T extends Color>(color: T): T => (mods ? { ...color, mods } : color);
  switch (node.name) {
    case 'a:srgbClr':
      return withMods({ type: 'rgb', value: (attr(node, 'val') ?? '000000').toUpperCase() });
    case 'a:schemeClr':
      return withMods({ type: 'scheme', value: (attr(node, 'val') ?? 'tx1') as SchemeColorName });
    case 'a:sysClr': {
      const last = attr(node, 'lastClr');
      const value = attr(node, 'val') ?? 'windowText';
      return withMods(last ? { type: 'system', value, last } : { type: 'system', value });
    }
    case 'a:prstClr':
      return withMods({ type: 'preset', value: attr(node, 'val') ?? 'black' });
    case 'a:hslClr':
      return withMods({ type: 'rgb', value: hslToRgb((numAttr(node, 'hue') ?? 0) / 60000, (numAttr(node, 'sat') ?? 0) / 100000, (numAttr(node, 'lum') ?? 0) / 100000) });
    case 'a:scrgbClr': {
      const lin = (v: number | undefined): number => {
        const x = (v ?? 0) / 100000;
        return (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255;
      };
      return withMods({ type: 'rgb', value: hex(lin(numAttr(node, 'r'))) + hex(lin(numAttr(node, 'g'))) + hex(lin(numAttr(node, 'b'))) });
    }
    default:
      return undefined;
  }
}

/** Premiere couleur enfant de `parent`. */
export function readColor(parent: XmlElement | undefined): Color | undefined {
  if (!parent) return undefined;
  for (const node of parent.children) {
    if (isElement(node) && COLOR_TAGS.has(node.name)) return readColorElement(node);
  }
  return undefined;
}

// ---- Remplissages ----

const FILL_TAGS = new Set(['a:noFill', 'a:solidFill', 'a:gradFill', 'a:blipFill', 'a:pattFill', 'a:grpFill']);

function readRect(node: XmlElement | undefined): Insets | undefined {
  if (!node) return undefined;
  return { left: pct(node, 'l') ?? 0, top: pct(node, 't') ?? 0, right: pct(node, 'r') ?? 0, bottom: pct(node, 'b') ?? 0 };
}

const nonZero = (rect: Insets | undefined): rect is Insets => !!rect && (rect.left !== 0 || rect.top !== 0 || rect.right !== 0 || rect.bottom !== 0);

/** Remplissage image (a:blipFill ou p:blipFill). */
export function readBlipFill(node: XmlElement, ctx: DmlReadContext): Fill | undefined {
  const blip = child(node, 'a:blip');
  const relId = attr(blip, 'r:embed');
  const mediaId = relId ? ctx.media(relId) : undefined;
  if (!mediaId) return undefined;
  const tileNode = child(node, 'a:tile');
  const fill: Fill = { type: 'image', mediaId, mode: tileNode ? 'tile' : 'stretch' };
  const crop = readRect(child(node, 'a:srcRect'));
  if (nonZero(crop)) fill.crop = crop;
  const stretch = readRect(child(child(node, 'a:stretch'), 'a:fillRect'));
  if (nonZero(stretch)) fill.stretch = stretch;
  if (tileNode) {
    fill.tile = { tx: emu(tileNode, 'tx') ?? 0, ty: emu(tileNode, 'ty') ?? 0, sx: pct(tileNode, 'sx') ?? 100, sy: pct(tileNode, 'sy') ?? 100 };
    const flip = attr(tileNode, 'flip');
    if (flip) fill.tile.flip = flip;
    const align = attr(tileNode, 'algn');
    if (align) fill.tile.align = align;
  }
  const alpha = child(blip, 'a:alphaModFix');
  if (alpha) fill.alpha = pct(alpha, 'amt') ?? 100;
  const rot = bool(node, 'rotWithShape');
  if (rot !== undefined) fill.rotateWithShape = rot;
  return fill;
}

export function readFillElement(node: XmlElement, ctx: DmlReadContext): Fill | undefined {
  switch (node.name) {
    case 'a:noFill':
      return { type: 'none' };
    case 'a:solidFill':
      return { type: 'solid', color: readColor(node) ?? { type: 'rgb', value: '000000' } };
    case 'a:grpFill':
      return { type: 'group' };
    case 'a:gradFill': {
      const stops = children(child(node, 'a:gsLst'), 'a:gs').map((gs) => ({
        position: pct(gs, 'pos') ?? 0,
        color: readColor(gs) ?? { type: 'rgb' as const, value: '000000' },
      }));
      const lin = child(node, 'a:lin');
      const path = child(node, 'a:path');
      const fill: Fill = { type: 'gradient', stops, kind: path ? ((attr(path, 'path') ?? 'circle') as 'circle' | 'rect' | 'shape') : 'linear' };
      const angle = numAttr(lin, 'ang');
      if (angle !== undefined) fill.angle = angleToDeg(angle);
      const scaled = bool(lin, 'scaled');
      if (scaled !== undefined) fill.scaled = scaled;
      const rot = bool(node, 'rotWithShape');
      if (rot !== undefined) fill.rotateWithShape = rot;
      const focus = readRect(child(path, 'a:fillToRect'));
      if (focus) fill.focus = focus;
      const flip = attr(node, 'flip');
      if (flip) fill.tileFlip = flip as 'none' | 'x' | 'y' | 'xy';
      return fill;
    }
    case 'a:pattFill':
      return {
        type: 'pattern',
        preset: attr(node, 'prst') ?? 'pct5',
        foreground: readColor(child(node, 'a:fgClr')) ?? { type: 'rgb', value: '000000' },
        background: readColor(child(node, 'a:bgClr')) ?? { type: 'rgb', value: 'FFFFFF' },
      };
    case 'a:blipFill':
      return readBlipFill(node, ctx);
    default:
      return undefined;
  }
}

/** Premier remplissage enfant de `parent` (spPr, rPr, tcPr, bgPr...). */
export function readFill(parent: XmlElement | undefined, ctx: DmlReadContext): Fill | undefined {
  if (!parent) return undefined;
  for (const node of parent.children) {
    if (isElement(node) && FILL_TAGS.has(node.name)) return readFillElement(node, ctx);
  }
  return undefined;
}

// ---- Contours ----

function readLineEnd(node: XmlElement | undefined): LineEnd | undefined {
  if (!node) return undefined;
  const end: LineEnd = { type: (attr(node, 'type') ?? 'none') as LineEnd['type'] };
  const w = attr(node, 'w');
  const len = attr(node, 'len');
  if (w) end.width = w as 'sm' | 'med' | 'lg';
  if (len) end.length = len as 'sm' | 'med' | 'lg';
  return end;
}

export function readLine(node: XmlElement | undefined, ctx: DmlReadContext): Line | undefined {
  if (!node) return undefined;
  const line: Line = {};
  const fill = readFill(node, ctx);
  if (fill) line.fill = fill;
  const width = emu(node, 'w');
  if (width !== undefined) line.width = width;
  const dash = attr(child(node, 'a:prstDash'), 'val');
  if (dash) line.dash = dash;
  const custom = child(node, 'a:custDash');
  if (custom) line.customDash = children(custom, 'a:ds').map((ds) => ({ dash: pct(ds, 'd') ?? 0, space: pct(ds, 'sp') ?? 0 }));
  const cap = attr(node, 'cap');
  if (cap) line.cap = cap as Line['cap'];
  const compound = attr(node, 'cmpd');
  if (compound) line.compound = compound as Line['compound'];
  const align = attr(node, 'algn');
  if (align) line.align = align as Line['align'];
  if (child(node, 'a:round')) line.join = 'round';
  else if (child(node, 'a:bevel')) line.join = 'bevel';
  else if (child(node, 'a:miter')) line.join = 'miter';
  const head = readLineEnd(child(node, 'a:headEnd'));
  if (head) line.head = head;
  const tail = readLineEnd(child(node, 'a:tailEnd'));
  if (tail) line.tail = tail;
  return line;
}

// ---- Effets ----

function readShadow(node: XmlElement): NonNullable<Effects['outerShadow']> {
  const shadow: NonNullable<Effects['outerShadow']> = {
    color: readColor(node) ?? { type: 'rgb', value: '000000' },
    blur: emu(node, 'blurRad') ?? 0,
    distance: emu(node, 'dist') ?? 0,
    direction: angleToDeg(numAttr(node, 'dir') ?? 0),
  };
  const sx = pct(node, 'sx');
  if (sx !== undefined) shadow.scaleX = sx;
  const sy = pct(node, 'sy');
  if (sy !== undefined) shadow.scaleY = sy;
  const kx = numAttr(node, 'kx');
  if (kx !== undefined) shadow.skewX = angleToDeg(kx);
  const ky = numAttr(node, 'ky');
  if (ky !== undefined) shadow.skewY = angleToDeg(ky);
  const align = attr(node, 'algn');
  if (align) shadow.align = align;
  const rot = bool(node, 'rotWithShape');
  if (rot !== undefined) shadow.rotateWithShape = rot;
  return shadow;
}

function readReflection(node: XmlElement): NonNullable<Effects['reflection']> {
  const reflection: NonNullable<Effects['reflection']> = {
    blur: emu(node, 'blurRad') ?? 0,
    startAlpha: pct(node, 'stA') ?? 100,
    startPosition: pct(node, 'stPos') ?? 0,
    endAlpha: pct(node, 'endA') ?? 0,
    endPosition: pct(node, 'endPos') ?? 100,
    distance: emu(node, 'dist') ?? 0,
    direction: angleToDeg(numAttr(node, 'dir') ?? 0),
    fadeDirection: angleToDeg(numAttr(node, 'fadeDir') ?? 5400000),
    scaleX: pct(node, 'sx') ?? 100,
    scaleY: pct(node, 'sy') ?? 100,
  };
  const kx = numAttr(node, 'kx');
  if (kx !== undefined) reflection.skewX = angleToDeg(kx);
  const ky = numAttr(node, 'ky');
  if (ky !== undefined) reflection.skewY = angleToDeg(ky);
  const align = attr(node, 'algn');
  if (align) reflection.align = align;
  const rot = bool(node, 'rotWithShape');
  if (rot !== undefined) reflection.rotateWithShape = rot;
  return reflection;
}

/** Effets d'un element contenant a:effectLst (la 3D de `extraFrom` est conservee). */
export function readEffects(parent: XmlElement | undefined, extraFrom?: XmlElement): Effects | undefined {
  const list = child(parent, 'a:effectLst');
  const effects: Effects = {};
  for (const node of children(list)) {
    switch (node.name) {
      case 'a:outerShdw':
        effects.outerShadow = readShadow(node);
        break;
      case 'a:innerShdw':
        effects.innerShadow = readShadow(node);
        break;
      case 'a:prstShdw':
        effects.presetShadow = {
          preset: attr(node, 'prst') ?? 'shdw1',
          color: readColor(node) ?? { type: 'rgb', value: '000000' },
          distance: emu(node, 'dist') ?? 0,
          direction: angleToDeg(numAttr(node, 'dir') ?? 0),
        };
        break;
      case 'a:glow':
        effects.glow = { color: readColor(node) ?? { type: 'rgb', value: '000000' }, radius: emu(node, 'rad') ?? 0 };
        break;
      case 'a:softEdge':
        effects.softEdge = emu(node, 'rad') ?? 0;
        break;
      case 'a:blur': {
        const grow = bool(node, 'grow');
        effects.blur = grow === undefined ? { radius: emu(node, 'rad') ?? 0 } : { radius: emu(node, 'rad') ?? 0, grow };
        break;
      }
      case 'a:reflection':
        effects.reflection = readReflection(node);
        break;
      default:
        break;
    }
  }
  const extra = children(extraFrom).filter((n) => n.name === 'a:scene3d' || n.name === 'a:sp3d').map((n) => cloneXml(n));
  if (extra.length) effects.extra = extra;
  return Object.keys(effects).length || list ? effects : undefined;
}

// ---- Position et geometrie ----

export function readTransform(xfrm: XmlElement | undefined): Transform | undefined {
  if (!xfrm) return undefined;
  const off = child(xfrm, 'a:off');
  const ext = child(xfrm, 'a:ext');
  const transform: Transform = { x: emu(off, 'x') ?? 0, y: emu(off, 'y') ?? 0, width: emu(ext, 'cx') ?? 0, height: emu(ext, 'cy') ?? 0 };
  const rot = numAttr(xfrm, 'rot');
  if (rot) transform.rotation = angleToDeg(rot);
  if (bool(xfrm, 'flipH')) transform.flipH = true;
  if (bool(xfrm, 'flipV')) transform.flipV = true;
  return transform;
}

const ADJUST_RE = /^val\s+(-?\d+)$/;

export function readAdjust(avLst: XmlElement | undefined): Record<string, number> | undefined {
  const values: Record<string, number> = {};
  for (const gd of children(avLst, 'a:gd')) {
    const match = (attr(gd, 'fmla') ?? '').match(ADJUST_RE);
    const name = attr(gd, 'name');
    if (match && name) values[name] = Number(match[1]);
  }
  return Object.keys(values).length ? values : undefined;
}

function readGuides(list: XmlElement | undefined): GeometryGuide[] | undefined {
  const guides = children(list, 'a:gd').map((gd) => ({ name: attr(gd, 'name') ?? '', formula: attr(gd, 'fmla') ?? '' }));
  return guides.length ? guides : undefined;
}

const pathValue = (raw: string | undefined): PathValue => {
  if (raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && raw.trim() !== '' ? n : raw;
};

const point = (node: XmlElement | undefined): PathPoint => ({ x: pathValue(attr(node, 'x')), y: pathValue(attr(node, 'y')) });

function readPath(node: XmlElement): GeometryPath {
  const commands: PathCommand[] = [];
  for (const cmd of children(node)) {
    const pts = children(cmd, 'a:pt').map(point);
    const [p0, p1, p2] = pts;
    switch (cmd.name) {
      case 'a:moveTo':
        if (p0) commands.push({ cmd: 'moveTo', pt: p0 });
        break;
      case 'a:lnTo':
        if (p0) commands.push({ cmd: 'lineTo', pt: p0 });
        break;
      case 'a:cubicBezTo':
        if (p0 && p1 && p2) commands.push({ cmd: 'cubicBezTo', pts: [p0, p1, p2] });
        break;
      case 'a:quadBezTo':
        if (p0 && p1) commands.push({ cmd: 'quadBezTo', pts: [p0, p1] });
        break;
      case 'a:arcTo':
        commands.push({ cmd: 'arcTo', wR: pathValue(attr(cmd, 'wR')), hR: pathValue(attr(cmd, 'hR')), stAng: pathValue(attr(cmd, 'stAng')), swAng: pathValue(attr(cmd, 'swAng')) });
        break;
      case 'a:close':
        commands.push({ cmd: 'close' });
        break;
      default:
        break;
    }
  }
  const path: GeometryPath = { commands };
  const w = numAttr(node, 'w');
  if (w !== undefined) path.width = w;
  const h = numAttr(node, 'h');
  if (h !== undefined) path.height = h;
  const fill = attr(node, 'fill');
  if (fill) path.fill = fill as GeometryPath['fill'];
  const stroke = bool(node, 'stroke');
  if (stroke !== undefined) path.stroke = stroke;
  const extrusion = bool(node, 'extrusionOk');
  if (extrusion !== undefined) path.extrusionOk = extrusion;
  return path;
}

/** Geometrie d'un spPr (prstGeom ou custGeom). */
export function readGeometry(spPr: XmlElement | undefined): Geometry | undefined {
  const preset = child(spPr, 'a:prstGeom');
  if (preset) {
    const geometry: Geometry = { type: 'preset', preset: attr(preset, 'prst') ?? 'rect' };
    const adjust = readAdjust(child(preset, 'a:avLst'));
    if (adjust) geometry.adjust = adjust;
    return geometry;
  }
  const custom = child(spPr, 'a:custGeom');
  if (!custom) return undefined;
  const geometry: Geometry = { type: 'custom', paths: children(child(custom, 'a:pathLst'), 'a:path').map(readPath) };
  const guides = readGuides(child(custom, 'a:gdLst'));
  if (guides) geometry.guides = guides;
  const adjust = readGuides(child(custom, 'a:avLst'));
  if (adjust) geometry.adjust = adjust;
  const sites = children(child(custom, 'a:cxnLst'), 'a:cxn').map((cxn) => ({ angle: pathValue(attr(cxn, 'ang')), pos: point(child(cxn, 'a:pos')) }));
  if (sites.length) geometry.connectionSites = sites;
  const rect = child(custom, 'a:rect');
  if (rect) geometry.textRect = { l: pathValue(attr(rect, 'l')), t: pathValue(attr(rect, 't')), r: pathValue(attr(rect, 'r')), b: pathValue(attr(rect, 'b')) };
  return geometry;
}

export function readShapeStyle(node: XmlElement | undefined): ShapeStyle | undefined {
  if (!node) return undefined;
  const ref = (name: string): ShapeStyle['line'] => {
    const r = child(node, name);
    if (!r) return undefined;
    const color = readColor(r);
    return color ? { index: numAttr(r, 'idx') ?? 0, color } : { index: numAttr(r, 'idx') ?? 0 };
  };
  const style: ShapeStyle = {};
  const line = ref('a:lnRef');
  if (line) style.line = line;
  const fill = ref('a:fillRef');
  if (fill) style.fill = fill;
  const effect = ref('a:effectRef');
  if (effect) style.effect = effect;
  const font = child(node, 'a:fontRef');
  if (font) {
    const color = readColor(font);
    const index = (attr(font, 'idx') ?? 'minor') as 'major' | 'minor' | 'none';
    style.font = color ? { index, color } : { index };
  }
  return style;
}

// ---- Texte ----

export function readHyperlink(node: XmlElement | undefined, ctx: DmlReadContext): Hyperlink | undefined {
  if (!node) return undefined;
  const link: Hyperlink = {};
  const relId = attr(node, 'r:id');
  if (relId) Object.assign(link, ctx.hyperlink(relId) ?? {});
  const action = attr(node, 'action');
  if (action) link.action = action;
  const tooltip = attr(node, 'tooltip');
  if (tooltip) link.tooltip = tooltip;
  if (bool(node, 'highlightClick')) link.highlightClick = true;
  return link.url !== undefined || link.slideId !== undefined || link.action !== undefined ? link : undefined;
}

export function readRunProps(node: XmlElement | undefined, ctx: DmlReadContext): RunProps {
  const props: RunProps = {};
  if (!node) return props;
  const size = numAttr(node, 'sz');
  if (size !== undefined) props.size = size / 100;
  const b = bool(node, 'b');
  if (b !== undefined) props.bold = b;
  const i = bool(node, 'i');
  if (i !== undefined) props.italic = i;
  const u = attr(node, 'u');
  if (u) props.underline = u;
  const strike = attr(node, 'strike');
  if (strike) props.strike = strike as RunProps['strike'];
  const baseline = numAttr(node, 'baseline');
  if (baseline !== undefined) props.baseline = baseline / 1000;
  const spc = numAttr(node, 'spc');
  if (spc !== undefined) props.spacing = spc / 100;
  const cap = attr(node, 'cap');
  if (cap) props.caps = cap as RunProps['caps'];
  const kern = numAttr(node, 'kern');
  if (kern !== undefined) props.kern = kern / 100;
  const lang = attr(node, 'lang');
  if (lang) props.lang = lang;
  const altLang = attr(node, 'altLang');
  if (altLang) props.altLang = altLang;
  if (bool(node, 'noProof')) props.noProof = true;
  const fill = readFill(node, ctx);
  if (fill?.type === 'solid') props.color = fill.color;
  else if (fill) props.textFill = fill;
  const outline = readLine(child(node, 'a:ln'), ctx);
  if (outline) props.outline = outline;
  const effects = child(node, 'a:effectLst') ? readEffects(node) : undefined;
  if (effects) props.effects = effects;
  const highlight = readColor(child(node, 'a:highlight'));
  if (highlight) props.highlight = highlight;
  const uColor = readColor(child(child(node, 'a:uFill'), 'a:solidFill'));
  if (uColor) props.underlineColor = uColor;
  const latin = attr(child(node, 'a:latin'), 'typeface');
  if (latin) props.font = latin;
  const ea = attr(child(node, 'a:ea'), 'typeface');
  if (ea) props.eastAsianFont = ea;
  const cs = attr(child(node, 'a:cs'), 'typeface');
  if (cs) props.complexFont = cs;
  const sym = attr(child(node, 'a:sym'), 'typeface');
  if (sym) props.symbolFont = sym;
  const link = readHyperlink(child(node, 'a:hlinkClick'), ctx);
  if (link) props.link = link;
  const hover = readHyperlink(child(node, 'a:hlinkMouseOver'), ctx);
  if (hover) props.hoverLink = hover;
  const rtl = child(node, 'a:rtl');
  if (rtl && attr(rtl, 'val') !== '0') props.rtl = true;
  return props;
}

function readSpacing(node: XmlElement | undefined): Spacing | undefined {
  const pctNode = child(node, 'a:spcPct');
  if (pctNode) return { type: 'pct', value: pct(pctNode, 'val') ?? 100 };
  const ptsNode = child(node, 'a:spcPts');
  if (ptsNode) return { type: 'pts', value: (numAttr(ptsNode, 'val') ?? 0) / 100 };
  return undefined;
}

function readBullet(node: XmlElement, ctx: DmlReadContext): Bullet | undefined {
  if (child(node, 'a:buNone')) return { type: 'none' };
  const buChar = child(node, 'a:buChar');
  if (buChar) return { type: 'char', char: attr(buChar, 'char') ?? '•' };
  const auto = child(node, 'a:buAutoNum');
  if (auto) {
    const startAt = numAttr(auto, 'startAt');
    const scheme = attr(auto, 'type') ?? 'arabicPeriod';
    return startAt === undefined ? { type: 'auto', scheme } : { type: 'auto', scheme, startAt };
  }
  const relId = attr(child(child(node, 'a:buBlip'), 'a:blip'), 'r:embed');
  const mediaId = relId ? ctx.media(relId) : undefined;
  return mediaId ? { type: 'image', mediaId } : undefined;
}

export function readParagraphProps(node: XmlElement | undefined, ctx: DmlReadContext): ParagraphProps {
  const props: ParagraphProps = {};
  if (!node) return props;
  const align = attr(node, 'algn');
  if (align) props.align = align as ParagraphProps['align'];
  const level = numAttr(node, 'lvl');
  if (level !== undefined) props.level = level;
  const marL = emu(node, 'marL');
  if (marL !== undefined) props.marginLeft = marL;
  const marR = emu(node, 'marR');
  if (marR !== undefined) props.marginRight = marR;
  const indent = emu(node, 'indent');
  if (indent !== undefined) props.indent = indent;
  const defTab = emu(node, 'defTabSz');
  if (defTab !== undefined) props.defaultTabSize = defTab;
  const rtl = bool(node, 'rtl');
  if (rtl !== undefined) props.rtl = rtl;
  const fontAlign = attr(node, 'fontAlgn');
  if (fontAlign) props.fontAlign = fontAlign as ParagraphProps['fontAlign'];
  const ea = bool(node, 'eaLnBrk');
  if (ea !== undefined) props.eastAsianLineBreak = ea;
  const latin = bool(node, 'latinLnBrk');
  if (latin !== undefined) props.latinLineBreak = latin;
  const hanging = bool(node, 'hangingPunct');
  if (hanging !== undefined) props.hangingPunctuation = hanging;
  const lnSpc = readSpacing(child(node, 'a:lnSpc'));
  if (lnSpc) props.lineSpacing = lnSpc;
  const before = readSpacing(child(node, 'a:spcBef'));
  if (before) props.spaceBefore = before;
  const after = readSpacing(child(node, 'a:spcAft'));
  if (after) props.spaceAfter = after;
  if (child(node, 'a:buClrTx')) props.bulletColor = 'text';
  else {
    const color = readColor(child(node, 'a:buClr'));
    if (color) props.bulletColor = color;
  }
  if (child(node, 'a:buSzTx')) props.bulletSize = { type: 'text' };
  else if (child(node, 'a:buSzPct')) props.bulletSize = { type: 'pct', value: pct(child(node, 'a:buSzPct'), 'val') ?? 100 };
  else if (child(node, 'a:buSzPts')) props.bulletSize = { type: 'pts', value: (numAttr(child(node, 'a:buSzPts'), 'val') ?? 0) / 100 };
  if (child(node, 'a:buFontTx')) props.bulletFont = 'text';
  else {
    const font = attr(child(node, 'a:buFont'), 'typeface');
    if (font) props.bulletFont = font;
  }
  const bullet = readBullet(node, ctx);
  if (bullet) props.bullet = bullet;
  const tabs = children(child(node, 'a:tabLst'), 'a:tab').map((tab) => ({ position: emu(tab, 'pos') ?? 0, align: (attr(tab, 'algn') ?? 'l') as 'l' | 'ctr' | 'r' | 'dec' }));
  if (tabs.length) props.tabs = tabs;
  const defRPr = child(node, 'a:defRPr');
  if (defRPr) props.defaultRun = readRunProps(defRPr, ctx);
  return props;
}

export function readListStyle(node: XmlElement | undefined, ctx: DmlReadContext): ListStyle | undefined {
  if (!node) return undefined;
  const style: ListStyle = { levels: {} };
  const def = child(node, 'a:defPPr');
  if (def) style.def = readParagraphProps(def, ctx);
  for (let level = 0; level < 9; level++) {
    const lvl = child(node, `a:lvl${level + 1}pPr`);
    if (lvl) style.levels[level] = readParagraphProps(lvl, ctx);
  }
  return style;
}

export function readParagraph(node: XmlElement, ctx: DmlReadContext): Paragraph {
  const paragraph: Paragraph = { props: readParagraphProps(child(node, 'a:pPr'), ctx), runs: [] };
  for (const item of children(node)) {
    if (item.name === 'a:r') {
      paragraph.runs.push({ type: 'text', text: textOf(child(item, 'a:t')), props: readRunProps(child(item, 'a:rPr'), ctx) });
    } else if (item.name === 'a:br') {
      paragraph.runs.push({ type: 'break', props: readRunProps(child(item, 'a:rPr'), ctx) });
    } else if (item.name === 'a:fld') {
      paragraph.runs.push({
        type: 'field',
        fieldType: attr(item, 'type') ?? '',
        id: attr(item, 'id') ?? '',
        text: textOf(child(item, 'a:t')),
        props: readRunProps(child(item, 'a:rPr'), ctx),
      });
    }
  }
  const end = child(node, 'a:endParaRPr');
  if (end) paragraph.endProps = readRunProps(end, ctx);
  return paragraph;
}

function readAutofit(bodyPr: XmlElement): Autofit | undefined {
  if (child(bodyPr, 'a:noAutofit')) return { type: 'none' };
  if (child(bodyPr, 'a:spAutoFit')) return { type: 'shape' };
  const normal = child(bodyPr, 'a:normAutofit');
  if (!normal) return undefined;
  const fit: Autofit = { type: 'normal' };
  const scale = pct(normal, 'fontScale');
  if (scale !== undefined) fit.fontScale = scale;
  const reduction = pct(normal, 'lnSpcReduction');
  if (reduction !== undefined) fit.lineSpacingReduction = reduction;
  return fit;
}

export function readBodyProps(bodyPr: XmlElement | undefined): BodyProps {
  const props: BodyProps = {};
  if (!bodyPr) return props;
  const insets: Partial<Insets> = {};
  const map = [['lIns', 'left'], ['tIns', 'top'], ['rIns', 'right'], ['bIns', 'bottom']] as const;
  for (const [key, side] of map) {
    const value = emu(bodyPr, key);
    if (value !== undefined) insets[side] = value;
  }
  if (Object.keys(insets).length) props.insets = insets;
  const anchor = attr(bodyPr, 'anchor');
  if (anchor) props.anchor = anchor as BodyProps['anchor'];
  const anchorCtr = bool(bodyPr, 'anchorCtr');
  if (anchorCtr !== undefined) props.anchorCenter = anchorCtr;
  const wrap = attr(bodyPr, 'wrap');
  if (wrap) props.wrap = wrap !== 'none';
  const cols = numAttr(bodyPr, 'numCol');
  if (cols !== undefined) props.columns = cols;
  const spcCol = emu(bodyPr, 'spcCol');
  if (spcCol !== undefined) props.columnSpacing = spcCol;
  const rtlCol = bool(bodyPr, 'rtlCol');
  if (rtlCol !== undefined) props.rtlColumns = rtlCol;
  const vert = attr(bodyPr, 'vert');
  if (vert) props.vertical = vert as BodyProps['vertical'];
  const rot = numAttr(bodyPr, 'rot');
  if (rot !== undefined) props.rotation = angleToDeg(rot);
  const upright = bool(bodyPr, 'upright');
  if (upright !== undefined) props.upright = upright;
  const horz = attr(bodyPr, 'horzOverflow');
  if (horz) props.horzOverflow = horz as BodyProps['horzOverflow'];
  const vertOverflow = attr(bodyPr, 'vertOverflow');
  if (vertOverflow) props.vertOverflow = vertOverflow as BodyProps['vertOverflow'];
  const autofit = readAutofit(bodyPr);
  if (autofit) props.autofit = autofit;
  const warp = child(bodyPr, 'a:prstTxWarp');
  if (warp) {
    const adjust = readAdjust(child(warp, 'a:avLst'));
    const preset = attr(warp, 'prst') ?? 'textNoShape';
    props.warp = adjust ? { preset, adjust } : { preset };
  }
  const extra = children(bodyPr).filter((n) => n.name === 'a:scene3d' || n.name === 'a:sp3d' || n.name === 'a:flatTx').map((n) => cloneXml(n));
  if (extra.length) props.extra = extra;
  return props;
}

/** Lit un corps de texte (p:txBody, a:txBody, c:rich). */
export function readTextBody(node: XmlElement | undefined, ctx: DmlReadContext): TextBody | undefined {
  if (!node) return undefined;
  const body: TextBody = { props: readBodyProps(child(node, 'a:bodyPr')), paragraphs: children(node, 'a:p').map((p) => readParagraph(p, ctx)) };
  const listStyle = readListStyle(child(node, 'a:lstStyle'), ctx);
  if (listStyle && (listStyle.def || Object.keys(listStyle.levels).length)) body.listStyle = listStyle;
  return body;
}
