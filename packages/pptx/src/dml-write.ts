// Ecriture DrawingML (a:*) depuis le modele, dans l'ordre exige par le schema (PowerPoint est strict).
import { el, type XmlElement } from '@forgeoffice/opc';
import type {
  BodyProps,
  Color,
  Effects,
  Fill,
  Geometry,
  GeometryPath,
  Hyperlink,
  Insets,
  Line,
  LineEnd,
  ListStyle,
  Paragraph,
  ParagraphProps,
  PathPoint,
  RunProps,
  ShapeStyle,
  Spacing,
  TextBody,
  Transform,
} from './dml.ts';
import { cloneXml } from './xmlns.ts';
import { degToAngle, pctToOoPct, ptToEmu } from './units.ts';

/** Ce dont l'ecriture a besoin pour creer les relations de la partie courante. */
export interface DmlWriteContext {
  /** Identifiant de relation vers le media (cree au besoin). */
  mediaRel(mediaId: string): string;
  /** Relation de lien hypertexte (externe ou vers une diapositive) ; undefined si le lien n'a pas de cible. */
  hyperlinkRel(link: Hyperlink): string | undefined;
}

const flag = (value: boolean | undefined): string | undefined => (value === undefined ? undefined : value ? '1' : '0');
const optEmu = (value: number | undefined): number | undefined => (value === undefined ? undefined : ptToEmu(value));
const optPct = (value: number | undefined): number | undefined => (value === undefined ? undefined : pctToOoPct(value));
const optAngle = (value: number | undefined): number | undefined => (value === undefined ? undefined : degToAngle(value));

// ---- Couleurs et remplissages ----

export function writeColor(color: Color): XmlElement {
  const mods = (color.mods ?? []).map((mod) => el(`a:${mod.name}`, { val: mod.val }));
  switch (color.type) {
    case 'rgb':
      return el('a:srgbClr', { val: color.value.toUpperCase() }, mods);
    case 'scheme':
      return el('a:schemeClr', { val: color.value }, mods);
    case 'system':
      return el('a:sysClr', { val: color.value, lastClr: color.last }, mods);
    case 'preset':
      return el('a:prstClr', { val: color.value }, mods);
  }
}

function writeRect(name: string, rect: Insets | undefined): XmlElement {
  return el(name, rect ? { l: optPct(rect.left || undefined), t: optPct(rect.top || undefined), r: optPct(rect.right || undefined), b: optPct(rect.bottom || undefined) } : {});
}

/** Remplissage image ; `name` = a:blipFill ou p:blipFill ; `blipExtra` = effets d'image ajoutes au blip. */
export function writeBlipFill(fill: Extract<Fill, { type: 'image' }>, ctx: DmlWriteContext, name = 'a:blipFill', blipExtra: XmlElement[] = [], blipExt?: XmlElement): XmlElement {
  const blipKids: XmlElement[] = [];
  if (fill.alpha !== undefined) blipKids.push(el('a:alphaModFix', { amt: pctToOoPct(fill.alpha) }));
  blipKids.push(...blipExtra);
  if (blipExt) blipKids.push(blipExt);
  const kids: XmlElement[] = [el('a:blip', { 'r:embed': ctx.mediaRel(fill.mediaId) }, blipKids)];
  if (fill.crop) kids.push(writeRect('a:srcRect', fill.crop));
  if (fill.mode === 'tile') {
    const tile = fill.tile ?? { tx: 0, ty: 0, sx: 100, sy: 100 };
    kids.push(el('a:tile', { tx: ptToEmu(tile.tx), ty: ptToEmu(tile.ty), sx: pctToOoPct(tile.sx), sy: pctToOoPct(tile.sy), flip: tile.flip ?? 'none', algn: tile.align ?? 'tl' }));
  } else {
    kids.push(el('a:stretch', {}, [writeRect('a:fillRect', fill.stretch)]));
  }
  return el(name, { rotWithShape: flag(fill.rotateWithShape) }, kids);
}

export function writeFill(fill: Fill | undefined, ctx: DmlWriteContext): XmlElement | undefined {
  if (!fill) return undefined;
  switch (fill.type) {
    case 'none':
      return el('a:noFill');
    case 'solid':
      return el('a:solidFill', {}, [writeColor(fill.color)]);
    case 'group':
      return el('a:grpFill');
    case 'gradient': {
      const kids: XmlElement[] = [el('a:gsLst', {}, fill.stops.map((stop) => el('a:gs', { pos: pctToOoPct(stop.position) }, [writeColor(stop.color)])))];
      if (fill.kind === 'linear') {
        if (fill.angle !== undefined || fill.scaled !== undefined) kids.push(el('a:lin', { ang: degToAngle(fill.angle ?? 0), scaled: flag(fill.scaled ?? false) }));
      } else {
        kids.push(el('a:path', { path: fill.kind }, [writeRect('a:fillToRect', fill.focus ?? { left: 50, top: 50, right: 50, bottom: 50 })]));
      }
      return el('a:gradFill', { flip: fill.tileFlip, rotWithShape: flag(fill.rotateWithShape) }, kids);
    }
    case 'pattern':
      return el('a:pattFill', { prst: fill.preset }, [el('a:fgClr', {}, [writeColor(fill.foreground)]), el('a:bgClr', {}, [writeColor(fill.background)])]);
    case 'image':
      return writeBlipFill(fill, ctx);
  }
}

// ---- Contours ----

function writeLineEnd(name: string, end: LineEnd | undefined): XmlElement | undefined {
  return end ? el(name, { type: end.type, w: end.width, len: end.length }) : undefined;
}

export function writeLine(line: Line, ctx: DmlWriteContext, name = 'a:ln'): XmlElement {
  const kids: XmlElement[] = [];
  const fill = writeFill(line.fill, ctx);
  if (fill) kids.push(fill);
  if (line.customDash) kids.push(el('a:custDash', {}, line.customDash.map((ds) => el('a:ds', { d: pctToOoPct(ds.dash), sp: pctToOoPct(ds.space) }))));
  else if (line.dash) kids.push(el('a:prstDash', { val: line.dash }));
  if (line.join === 'round') kids.push(el('a:round'));
  else if (line.join === 'bevel') kids.push(el('a:bevel'));
  else if (line.join === 'miter') kids.push(el('a:miter', { lim: 800000 }));
  const head = writeLineEnd('a:headEnd', line.head);
  if (head) kids.push(head);
  const tail = writeLineEnd('a:tailEnd', line.tail);
  if (tail) kids.push(tail);
  return el(name, { w: optEmu(line.width), cap: line.cap, cmpd: line.compound, algn: line.align }, kids);
}

// ---- Effets ----

function writeShadow(name: string, shadow: NonNullable<Effects['outerShadow']>, outer: boolean): XmlElement {
  return el(
    name,
    {
      blurRad: ptToEmu(shadow.blur),
      dist: ptToEmu(shadow.distance),
      dir: degToAngle(shadow.direction),
      sx: outer ? optPct(shadow.scaleX) : undefined,
      sy: outer ? optPct(shadow.scaleY) : undefined,
      kx: outer ? optAngle(shadow.skewX) : undefined,
      ky: outer ? optAngle(shadow.skewY) : undefined,
      algn: outer ? shadow.align : undefined,
      rotWithShape: outer ? flag(shadow.rotateWithShape) : undefined,
    },
    [writeColor(shadow.color)],
  );
}

/** Liste d'effets (a:effectLst), dans l'ordre du schema. */
export function writeEffectList(effects: Effects): XmlElement {
  const kids: XmlElement[] = [];
  if (effects.blur) kids.push(el('a:blur', { rad: ptToEmu(effects.blur.radius), grow: flag(effects.blur.grow) }));
  if (effects.glow) kids.push(el('a:glow', { rad: ptToEmu(effects.glow.radius) }, [writeColor(effects.glow.color)]));
  if (effects.innerShadow) kids.push(writeShadow('a:innerShdw', effects.innerShadow, false));
  if (effects.outerShadow) kids.push(writeShadow('a:outerShdw', effects.outerShadow, true));
  if (effects.presetShadow) {
    const s = effects.presetShadow;
    kids.push(el('a:prstShdw', { prst: s.preset, dist: ptToEmu(s.distance), dir: degToAngle(s.direction) }, [writeColor(s.color)]));
  }
  if (effects.reflection) {
    const r = effects.reflection;
    kids.push(
      el('a:reflection', {
        blurRad: ptToEmu(r.blur),
        stA: pctToOoPct(r.startAlpha),
        stPos: pctToOoPct(r.startPosition),
        endA: pctToOoPct(r.endAlpha),
        endPos: pctToOoPct(r.endPosition),
        dist: ptToEmu(r.distance),
        dir: degToAngle(r.direction),
        fadeDir: degToAngle(r.fadeDirection),
        sx: pctToOoPct(r.scaleX),
        sy: pctToOoPct(r.scaleY),
        kx: optAngle(r.skewX),
        ky: optAngle(r.skewY),
        algn: r.align,
        rotWithShape: flag(r.rotateWithShape),
      }),
    );
  }
  if (effects.softEdge !== undefined) kids.push(el('a:softEdge', { rad: ptToEmu(effects.softEdge) }));
  return el('a:effectLst', {}, kids);
}

/** Effets + 3D conservee, a placer en fin de spPr. */
export function writeEffects(effects: Effects | undefined): XmlElement[] {
  if (!effects) return [];
  const out = [writeEffectList(effects)];
  for (const extra of effects.extra ?? []) out.push(cloneXml(extra));
  return out;
}

// ---- Position et geometrie ----

export function writeTransform(xfrm: Transform, name = 'a:xfrm', group?: { childOffset: { x: number; y: number }; childExtent: { width: number; height: number } }): XmlElement {
  const kids = [el('a:off', { x: ptToEmu(xfrm.x), y: ptToEmu(xfrm.y) }), el('a:ext', { cx: Math.max(0, ptToEmu(xfrm.width)), cy: Math.max(0, ptToEmu(xfrm.height)) })];
  if (group) {
    kids.push(el('a:chOff', { x: ptToEmu(group.childOffset.x), y: ptToEmu(group.childOffset.y) }));
    kids.push(el('a:chExt', { cx: Math.max(0, ptToEmu(group.childExtent.width)), cy: Math.max(0, ptToEmu(group.childExtent.height)) }));
  }
  return el(name, { rot: xfrm.rotation ? degToAngle(xfrm.rotation) : undefined, flipH: xfrm.flipH ? '1' : undefined, flipV: xfrm.flipV ? '1' : undefined }, kids);
}

const pv = (value: number | string): string => String(value);
const writePoint = (pt: PathPoint): XmlElement => el('a:pt', { x: pv(pt.x), y: pv(pt.y) });

function writePath(path: GeometryPath): XmlElement {
  const kids = path.commands.map((command) => {
    switch (command.cmd) {
      case 'moveTo':
        return el('a:moveTo', {}, [writePoint(command.pt)]);
      case 'lineTo':
        return el('a:lnTo', {}, [writePoint(command.pt)]);
      case 'cubicBezTo':
        return el('a:cubicBezTo', {}, command.pts.map(writePoint));
      case 'quadBezTo':
        return el('a:quadBezTo', {}, command.pts.map(writePoint));
      case 'arcTo':
        return el('a:arcTo', { wR: pv(command.wR), hR: pv(command.hR), stAng: pv(command.stAng), swAng: pv(command.swAng) });
      case 'close':
        return el('a:close');
    }
  });
  return el('a:path', { w: path.width, h: path.height, fill: path.fill, stroke: flag(path.stroke), extrusionOk: flag(path.extrusionOk) }, kids);
}

export function writeAdjustList(adjust: Record<string, number> | undefined): XmlElement {
  return el('a:avLst', {}, Object.entries(adjust ?? {}).map(([name, value]) => el('a:gd', { name, fmla: `val ${Math.round(value)}` })));
}

export function writeGeometry(geometry: Geometry): XmlElement {
  if (geometry.type === 'preset') return el('a:prstGeom', { prst: geometry.preset }, [writeAdjustList(geometry.adjust)]);
  const guides = (list: Array<{ name: string; formula: string }> | undefined, name: string): XmlElement =>
    el(name, {}, (list ?? []).map((gd) => el('a:gd', { name: gd.name, fmla: gd.formula })));
  const rect = geometry.textRect ?? { l: 'l', t: 't', r: 'r', b: 'b' };
  return el('a:custGeom', {}, [
    guides(geometry.adjust, 'a:avLst'),
    guides(geometry.guides, 'a:gdLst'),
    el('a:ahLst'),
    el('a:cxnLst', {}, (geometry.connectionSites ?? []).map((site) => el('a:cxn', { ang: pv(site.angle) }, [el('a:pos', { x: pv(site.pos.x), y: pv(site.pos.y) })]))),
    el('a:rect', { l: pv(rect.l), t: pv(rect.t), r: pv(rect.r), b: pv(rect.b) }),
    el('a:pathLst', {}, geometry.paths.map(writePath)),
  ]);
}

export function writeShapeStyle(style: ShapeStyle, name = 'p:style'): XmlElement {
  const ref = (tag: string, value: ShapeStyle['line']): XmlElement => el(tag, { idx: value?.index ?? 0 }, value?.color ? [writeColor(value.color)] : []);
  const font = style.font ?? { index: 'minor' as const };
  return el(name, {}, [
    ref('a:lnRef', style.line),
    ref('a:fillRef', style.fill),
    ref('a:effectRef', style.effect),
    el('a:fontRef', { idx: font.index }, font.color ? [writeColor(font.color)] : []),
  ]);
}

// ---- Texte ----

function writeHyperlink(name: string, link: Hyperlink, ctx: DmlWriteContext): XmlElement {
  const relId = ctx.hyperlinkRel(link);
  const action = link.action ?? (link.slideId !== undefined ? 'ppaction://hlinksldjump' : undefined);
  return el(name, { 'r:id': relId ?? '', action, tooltip: link.tooltip, highlightClick: link.highlightClick ? '1' : undefined });
}

export function writeRunProps(props: RunProps, ctx: DmlWriteContext, name = 'a:rPr'): XmlElement {
  const kids: XmlElement[] = [];
  if (props.outline) kids.push(writeLine(props.outline, ctx));
  const fill = writeFill(props.textFill ?? (props.color ? { type: 'solid', color: props.color } : undefined), ctx);
  if (fill) kids.push(fill);
  if (props.effects) kids.push(writeEffectList(props.effects));
  if (props.highlight) kids.push(el('a:highlight', {}, [writeColor(props.highlight)]));
  if (props.underlineColor) kids.push(el('a:uFill', {}, [el('a:solidFill', {}, [writeColor(props.underlineColor)])]));
  if (props.font) kids.push(el('a:latin', { typeface: props.font }));
  if (props.eastAsianFont) kids.push(el('a:ea', { typeface: props.eastAsianFont }));
  if (props.complexFont) kids.push(el('a:cs', { typeface: props.complexFont }));
  if (props.symbolFont) kids.push(el('a:sym', { typeface: props.symbolFont }));
  if (props.link) kids.push(writeHyperlink('a:hlinkClick', props.link, ctx));
  if (props.hoverLink) kids.push(writeHyperlink('a:hlinkMouseOver', props.hoverLink, ctx));
  if (props.rtl) kids.push(el('a:rtl', { val: '1' }));
  return el(
    name,
    {
      kern: props.kern === undefined ? undefined : Math.round(props.kern * 100),
      lang: props.lang,
      altLang: props.altLang,
      sz: props.size === undefined ? undefined : Math.round(props.size * 100),
      b: flag(props.bold),
      i: flag(props.italic),
      u: props.underline,
      strike: props.strike,
      cap: props.caps,
      spc: props.spacing === undefined ? undefined : Math.round(props.spacing * 100),
      baseline: props.baseline === undefined ? undefined : Math.round(props.baseline * 1000),
      noProof: props.noProof ? '1' : undefined,
    },
    kids,
  );
}

function writeSpacing(name: string, spacing: Spacing | undefined): XmlElement | undefined {
  if (!spacing) return undefined;
  const inner = spacing.type === 'pct' ? el('a:spcPct', { val: pctToOoPct(spacing.value) }) : el('a:spcPts', { val: Math.round(spacing.value * 100) });
  return el(name, {}, [inner]);
}

export function writeParagraphProps(props: ParagraphProps, ctx: DmlWriteContext, name = 'a:pPr'): XmlElement {
  const kids: XmlElement[] = [];
  for (const [tag, value] of [['a:lnSpc', props.lineSpacing], ['a:spcBef', props.spaceBefore], ['a:spcAft', props.spaceAfter]] as const) {
    const node = writeSpacing(tag, value);
    if (node) kids.push(node);
  }
  if (props.bulletColor === 'text') kids.push(el('a:buClrTx'));
  else if (props.bulletColor) kids.push(el('a:buClr', {}, [writeColor(props.bulletColor)]));
  if (props.bulletSize?.type === 'text') kids.push(el('a:buSzTx'));
  else if (props.bulletSize?.type === 'pct') kids.push(el('a:buSzPct', { val: pctToOoPct(props.bulletSize.value) }));
  else if (props.bulletSize?.type === 'pts') kids.push(el('a:buSzPts', { val: Math.round(props.bulletSize.value * 100) }));
  if (props.bulletFont === 'text') kids.push(el('a:buFontTx'));
  else if (props.bulletFont) kids.push(el('a:buFont', { typeface: props.bulletFont }));
  const bullet = props.bullet;
  if (bullet?.type === 'none') kids.push(el('a:buNone'));
  else if (bullet?.type === 'auto') kids.push(el('a:buAutoNum', { type: bullet.scheme, startAt: bullet.startAt }));
  else if (bullet?.type === 'char') kids.push(el('a:buChar', { char: bullet.char }));
  else if (bullet?.type === 'image') kids.push(el('a:buBlip', {}, [el('a:blip', { 'r:embed': ctx.mediaRel(bullet.mediaId) })]));
  if (props.tabs?.length) kids.push(el('a:tabLst', {}, props.tabs.map((tab) => el('a:tab', { pos: ptToEmu(tab.position), algn: tab.align }))));
  if (props.defaultRun) kids.push(writeRunProps(props.defaultRun, ctx, 'a:defRPr'));
  return el(
    name,
    {
      marL: optEmu(props.marginLeft),
      marR: optEmu(props.marginRight),
      lvl: props.level || undefined,
      indent: optEmu(props.indent),
      algn: props.align,
      defTabSz: optEmu(props.defaultTabSize),
      rtl: flag(props.rtl),
      eaLnBrk: flag(props.eastAsianLineBreak),
      fontAlgn: props.fontAlign,
      latinLnBrk: flag(props.latinLineBreak),
      hangingPunct: flag(props.hangingPunctuation),
    },
    kids,
  );
}

const isEmpty = (element: XmlElement): boolean => element.children.length === 0 && Object.keys(element.attrs).length === 0;

export function writeListStyle(style: ListStyle | undefined, ctx: DmlWriteContext, name = 'a:lstStyle'): XmlElement {
  const kids: XmlElement[] = [];
  if (style?.def) kids.push(writeParagraphProps(style.def, ctx, 'a:defPPr'));
  for (let level = 0; level < 9; level++) {
    const props = style?.levels[level];
    if (props) kids.push(writeParagraphProps(props, ctx, `a:lvl${level + 1}pPr`));
  }
  return el(name, {}, kids);
}

export function writeParagraph(paragraph: Paragraph, ctx: DmlWriteContext): XmlElement {
  const kids: XmlElement[] = [];
  const pPr = writeParagraphProps(paragraph.props, ctx);
  if (!isEmpty(pPr)) kids.push(pPr);
  for (const run of paragraph.runs) {
    if (run.type === 'text') kids.push(el('a:r', {}, [writeRunProps(run.props, ctx), el('a:t', {}, [run.text])]));
    else if (run.type === 'break') kids.push(el('a:br', {}, [writeRunProps(run.props, ctx)]));
    else kids.push(el('a:fld', { id: run.id || '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}', type: run.fieldType || undefined }, [writeRunProps(run.props, ctx), el('a:t', {}, [run.text])]));
  }
  if (paragraph.endProps) kids.push(writeRunProps(paragraph.endProps, ctx, 'a:endParaRPr'));
  return el('a:p', {}, kids);
}

export function writeBodyProps(props: BodyProps): XmlElement {
  const kids: XmlElement[] = [];
  if (props.warp) kids.push(el('a:prstTxWarp', { prst: props.warp.preset }, [writeAdjustList(props.warp.adjust)]));
  const fit = props.autofit;
  if (fit?.type === 'none') kids.push(el('a:noAutofit'));
  else if (fit?.type === 'shape') kids.push(el('a:spAutoFit'));
  else if (fit?.type === 'normal') kids.push(el('a:normAutofit', { fontScale: optPct(fit.fontScale), lnSpcReduction: optPct(fit.lineSpacingReduction) }));
  for (const extra of props.extra ?? []) kids.push(cloneXml(extra));
  const insets = props.insets ?? {};
  return el(
    'a:bodyPr',
    {
      rot: optAngle(props.rotation),
      spcFirstLastPara: undefined,
      vertOverflow: props.vertOverflow,
      horzOverflow: props.horzOverflow,
      vert: props.vertical,
      wrap: props.wrap === undefined ? undefined : props.wrap ? 'square' : 'none',
      lIns: optEmu(insets.left),
      tIns: optEmu(insets.top),
      rIns: optEmu(insets.right),
      bIns: optEmu(insets.bottom),
      numCol: props.columns,
      spcCol: optEmu(props.columnSpacing),
      rtlCol: flag(props.rtlColumns),
      anchor: props.anchor,
      anchorCtr: flag(props.anchorCenter),
      upright: flag(props.upright),
    },
    kids,
  );
}

/** Corps de texte complet ; un paragraphe vide est ajoute si besoin (le schema en exige au moins un). */
export function writeTextBody(body: TextBody, ctx: DmlWriteContext, name = 'p:txBody'): XmlElement {
  const paragraphs = body.paragraphs.length ? body.paragraphs.map((p) => writeParagraph(p, ctx)) : [el('a:p')];
  return el(name, {}, [writeBodyProps(body.props), writeListStyle(body.listStyle, ctx), ...paragraphs]);
}
