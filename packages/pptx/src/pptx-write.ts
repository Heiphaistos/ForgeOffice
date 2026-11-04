// Ecriture du modele Deck en paquet PresentationML ouvrable par PowerPoint (.pptx, .pptm, .potx, .potm, .ppsx, .ppsm).
import { el, PackageWriter, type XmlElement } from '@forgeoffice/opc';
import { writeTiming, writeTransition } from './anim.ts';
import { writeListStyle, writeParagraph as writeParagraphXml } from './dml-write.ts';
import type { Paragraph } from './dml.ts';
import { flattenShapes } from './edit.ts';
import type { ColorMap, Comment, Deck, DeckFormat, DocProperties, Layout, Master, Slide, Transition } from './model.ts';
import { PartEmitter, PathAllocator } from './preserve.ts';
import { declareNamespaces, PartWriteContext, writeBackground, writeShapeTree, type WriterState } from './shapes-write.ts';
import { STRINGS } from './strings.ts';
import { writeTheme } from './theme.ts';
import { clampSlideDimension, ptToEmu } from './units.ts';
import { cloneXml, CT, rootNamespaces, RT } from './xmlns.ts';

export interface WriteOptions {
  /** Format de sortie (sinon celui du modele). */
  format?: DeckFormat;
}

const MAIN_TYPES: Readonly<Record<DeckFormat, string>> = {
  pptx: CT.presentation,
  pptm: CT.presentationMacro,
  potx: CT.template,
  potm: CT.templateMacro,
  ppsx: CT.slideshow,
  ppsm: CT.slideshowMacro,
};

const root = (name: string, attrs: Record<string, string | number | undefined>, kids: XmlElement[]): XmlElement =>
  declareNamespaces(el(name, { ...rootNamespaces('a', 'r', 'p'), ...attrs }, kids));

function colorMapAttrs(map: ColorMap): Record<string, string> {
  return { ...map };
}

function cSld(ctx: PartWriteContext, name: string | undefined, background: Slide['background'], shapes: Slide['shapes']): XmlElement {
  const kids: XmlElement[] = [];
  if (background) kids.push(writeBackground(background, ctx));
  kids.push(writeShapeTree(shapes, ctx));
  return el('p:cSld', { name: name || undefined }, kids);
}

function clrMapOvr(map: ColorMap | undefined): XmlElement {
  return el('p:clrMapOvr', {}, [map ? el('a:overrideClrMapping', colorMapAttrs(map)) : el('a:masterClrMapping')]);
}

function transitionNode(transition: Transition | undefined, ctx: PartWriteContext): XmlElement[] {
  return transition ? [writeTransition(transition, (mediaId) => ctx.mediaRel(mediaId, RT.audio))] : [];
}

function writeLayout(state: WriterState, layout: Layout, path: string, masterPath: string): void {
  const ctx = new PartWriteContext(state, path);
  ctx.addRel(RT.master, masterPath);
  const xml = root(
    'p:sldLayout',
    { type: layout.type, preserve: layout.preserve ? '1' : undefined, userDrawn: layout.userDrawn ? '1' : undefined, showMasterSp: layout.showMasterShapes === false ? '0' : undefined },
    [cSld(ctx, layout.name, layout.background, layout.shapes), clrMapOvr(layout.colorMapOverride), ...transitionNode(layout.transition, ctx)],
  );
  state.writer.addXml(path, xml, CT.layout);
}

interface IdCounter {
  next: number;
}

function writeMaster(state: WriterState, master: Master, path: string, themePath: string, layoutPaths: Map<string, string>, ids: IdCounter): void {
  const ctx = new PartWriteContext(state, path);
  const layoutEntries: XmlElement[] = [];
  for (const layout of master.layouts) {
    const layoutPath = layoutPaths.get(layout.id);
    if (!layoutPath) continue;
    const relId = ctx.addRel(RT.layout, layoutPath);
    layoutEntries.push(el('p:sldLayoutId', { id: ids.next++, 'r:id': relId }));
    writeLayout(state, layout, layoutPath, path);
  }
  ctx.addRel(RT.theme, themePath);
  const themeCtx = new PartWriteContext(state, themePath);
  state.writer.addXml(themePath, declareNamespaces(writeTheme(master.theme, themeCtx)), CT.theme);
  const kids: XmlElement[] = [cSld(ctx, master.name, master.background, master.shapes), el('p:clrMap', colorMapAttrs(master.colorMap))];
  if (layoutEntries.length) kids.push(el('p:sldLayoutIdLst', {}, layoutEntries));
  kids.push(...transitionNode(master.transition, ctx));
  const hf = master.headerFooter;
  if (hf) kids.push(el('p:hf', { sldNum: hf.slideNumber === false ? '0' : undefined, hdr: hf.header === false ? '0' : undefined, ftr: hf.footer === false ? '0' : undefined, dt: hf.date === false ? '0' : undefined }));
  kids.push(
    el('p:txStyles', {}, [
      writeListStyle(master.textStyles.title, ctx, 'p:titleStyle'),
      writeListStyle(master.textStyles.body, ctx, 'p:bodyStyle'),
      writeListStyle(master.textStyles.other, ctx, 'p:otherStyle'),
    ]),
  );
  state.writer.addXml(path, root('p:sldMaster', { preserve: master.preserve ? '1' : undefined }, kids), CT.master);
}

// ---- Pages de notes ----

function notesPlaceholder(id: number, name: string, type: string, idx: number | undefined, extra: XmlElement[] = [], spLocks: Record<string, string> = { noGrp: '1' }): XmlElement {
  return el('p:sp', {}, [
    el('p:nvSpPr', {}, [el('p:cNvPr', { id, name }), el('p:cNvSpPr', {}, [el('a:spLocks', spLocks)]), el('p:nvPr', {}, [el('p:ph', { type, idx })])]),
    el('p:spPr'),
    ...extra,
  ]);
}

function emptyTree(kids: XmlElement[]): XmlElement {
  return el('p:spTree', {}, [
    el('p:nvGrpSpPr', {}, [el('p:cNvPr', { id: 1, name: '' }), el('p:cNvGrpSpPr'), el('p:nvPr')]),
    el('p:grpSpPr', {}, [el('a:xfrm', {}, [el('a:off', { x: 0, y: 0 }), el('a:ext', { cx: 0, cy: 0 }), el('a:chOff', { x: 0, y: 0 }), el('a:chExt', { cx: 0, cy: 0 })])]),
    ...kids,
  ]);
}

function textBody(paragraphs: Paragraph[] | undefined, ctx: PartWriteContext): XmlElement {
  const list = paragraphs ?? [];
  return el('p:txBody', {}, [el('a:bodyPr'), el('a:lstStyle'), ...(list.length ? list.map((p) => writeParagraphXml(p, ctx)) : [el('a:p')])]);
}

function writeNotesMaster(state: WriterState, deck: Deck, path: string, themePath: string): void {
  const ctx = new PartWriteContext(state, path);
  ctx.addRel(RT.theme, themePath);
  const master = deck.masters[0];
  if (master) state.writer.addXml(themePath, declareNamespaces(writeTheme(master.theme, new PartWriteContext(state, themePath))), CT.theme);
  const w = deck.notesSize.width;
  const h = deck.notesSize.height;
  const box = (x: number, y: number, cx: number, cy: number): XmlElement => el('a:xfrm', {}, [el('a:off', { x: ptToEmu(x), y: ptToEmu(y) }), el('a:ext', { cx: ptToEmu(cx), cy: ptToEmu(cy) })]);
  const sp = (id: number, name: string, type: string, idx: number | undefined, xfrm: XmlElement, prompt?: string): XmlElement => {
    const kids: XmlElement[] = [
      el('p:nvSpPr', {}, [el('p:cNvPr', { id, name }), el('p:cNvSpPr', {}, [el('a:spLocks', { noGrp: '1' })]), el('p:nvPr', {}, [el('p:ph', { type, idx })])]),
      el('p:spPr', {}, [xfrm, el('a:prstGeom', { prst: 'rect' }, [el('a:avLst')])]),
    ];
    if (prompt !== undefined) kids.push(el('p:txBody', {}, [el('a:bodyPr'), el('a:lstStyle'), el('a:p', {}, prompt ? [el('a:r', {}, [el('a:rPr', { lang: 'fr-FR' }), el('a:t', {}, [prompt])])] : [])]));
    return el('p:sp', {}, kids);
  };
  const tree = emptyTree([
    sp(2, 'Espace réservé de l’en-tête 1', 'hdr', undefined, box(0, 0, w / 2, h / 20), ''),
    sp(3, 'Espace réservé de la date 2', 'dt', 1, box(w / 2, 0, w / 2, h / 20), ''),
    sp(4, 'Espace réservé de l’image de la diapositive 3', 'sldImg', 2, box(w / 8, h / 12, (w * 3) / 4, (((w * 3) / 4) * deck.size.height) / deck.size.width)),
    sp(5, 'Espace réservé des notes 4', 'body', 3, box(w / 10, h / 2, (w * 4) / 5, (h * 2) / 5), STRINGS.promptNotes),
    sp(6, 'Espace réservé du pied de page 5', 'ftr', 4, box(0, (h * 19) / 20, w / 2, h / 20), ''),
    sp(7, 'Espace réservé du numéro de diapositive 6', 'sldNum', 5, box(w / 2, (h * 19) / 20, w / 2, h / 20), ''),
  ]);
  const level = (n: number): XmlElement =>
    el(`a:lvl${n + 1}pPr`, { marL: 457200 * n, algn: 'l', defTabSz: 914400, rtl: '0', eaLnBrk: '1', latinLnBrk: '0', hangingPunct: '1' }, [
      el('a:defRPr', { sz: 1200, kern: 1200 }, [el('a:solidFill', {}, [el('a:schemeClr', { val: 'tx1' })]), el('a:latin', { typeface: '+mn-lt' }), el('a:ea', { typeface: '+mn-ea' }), el('a:cs', { typeface: '+mn-cs' })]),
    ]);
  const xml = root('p:notesMaster', {}, [
    el('p:cSld', {}, [el('p:bg', {}, [el('p:bgRef', { idx: 1001 }, [el('a:schemeClr', { val: 'bg1' })])]), tree]),
    el('p:clrMap', colorMapAttrs(master?.colorMap ?? { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' })),
    el('p:notesStyle', {}, Array.from({ length: 9 }, (_, i) => level(i))),
  ]);
  state.writer.addXml(path, xml, CT.notesMaster);
}

function writeNotesSlide(state: WriterState, slide: Slide, path: string, slidePath: string, notesMasterPath: string): void {
  const ctx = new PartWriteContext(state, path);
  ctx.addRel(RT.notesMaster, notesMasterPath);
  ctx.addRel(RT.slide, slidePath);
  const tree = emptyTree([
    notesPlaceholder(2, 'Espace réservé de l’image des diapositives 1', 'sldImg', undefined, [], { noGrp: '1', noRot: '1', noChangeAspect: '1' }),
    notesPlaceholder(3, 'Espace réservé des notes 2', 'body', 1, [textBody(slide.notes, ctx)]),
  ]);
  state.writer.addXml(path, root('p:notes', {}, [el('p:cSld', {}, [tree]), clrMapOvr(undefined)]), CT.notesSlide);
}

// ---- Commentaires ----

interface AuthorTable {
  ids: Map<string, { id: number; initials: string; lastIdx: number }>;
}

function authorOf(table: AuthorTable, comment: Comment): { id: number; idx: number } {
  const known = table.ids.get(comment.author) ?? { id: table.ids.size, initials: comment.initials ?? comment.author.slice(0, 2), lastIdx: 0 };
  known.lastIdx++;
  table.ids.set(comment.author, known);
  return { id: known.id, idx: known.lastIdx };
}

function writeComments(state: WriterState, slide: Slide, ctx: PartWriteContext, table: AuthorTable): void {
  const flat = slide.comments.flatMap((c) => [c, ...(c.replies ?? []).map((r) => ({ ...r, position: r.position ?? c.position }))]);
  if (!flat.length) return;
  const path = state.paths.allocate('ppt/comments/comment1.xml');
  const items = flat.map((comment) => {
    const author = authorOf(table, comment);
    const pos = comment.position ?? { x: 10, y: 10 };
    return el('p:cm', { authorId: author.id, dt: comment.date ?? new Date().toISOString().slice(0, 19), idx: author.idx }, [el('p:pos', { x: Math.round(pos.x * 8), y: Math.round(pos.y * 8) }), el('p:text', {}, [comment.text])]);
  });
  state.writer.addXml(path, root('p:cmLst', {}, items), CT.comments);
  ctx.addRel(RT.comments, path);
}

// ---- Diapositives ----

function writeSlide(state: WriterState, slide: Slide, path: string, layoutPath: string, notes: { master: string; path: string } | undefined, authors: AuthorTable): void {
  const ctx = new PartWriteContext(state, path);
  ctx.addRel(RT.layout, layoutPath);
  const kids: XmlElement[] = [cSld(ctx, slide.name, slide.background, slide.shapes), clrMapOvr(slide.colorMapOverride), ...transitionNode(slide.transition, ctx)];
  if (slide.timing && slide.timing.fingerprint === JSON.stringify(slide.animations)) {
    kids.push(state.emitter.emitRaw(slide.timing, (type, target, external) => ctx.addRel(type, target, external)).xml);
  } else {
    const textShapes = new Set(flattenShapes(slide.shapes).filter((s) => s.kind === 'shape').map((s) => s.id));
    const timing = writeTiming(slide.animations, textShapes);
    if (timing) kids.push(timing);
  }
  if (notes && slide.notes?.length) {
    writeNotesSlide(state, slide, notes.path, path, notes.master);
    ctx.addRel(RT.notesSlide, notes.path);
  }
  writeComments(state, slide, ctx, authors);
  const attrs = { show: slide.hidden ? '0' : undefined, showMasterSp: slide.showMasterShapes === false ? '0' : undefined };
  state.writer.addXml(path, root('p:sld', attrs, kids), CT.slide);
}

// ---- Proprietes du document ----

function writeCore(props: DocProperties): XmlElement {
  const text = (name: string, value: string | undefined): XmlElement | undefined => (value === undefined ? undefined : el(name, {}, [value]));
  const date = (name: string, value: string | undefined): XmlElement | undefined => (value === undefined ? undefined : el(name, { 'xsi:type': 'dcterms:W3CDTF' }, [value]));
  const kids = [
    text('dc:title', props.title),
    text('dc:subject', props.subject),
    text('dc:creator', props.creator),
    text('cp:keywords', props.keywords),
    text('dc:description', props.description),
    text('cp:lastModifiedBy', props.lastModifiedBy),
    text('cp:revision', props.revision),
    date('dcterms:created', props.created),
    date('dcterms:modified', props.modified),
    text('cp:category', props.category),
    text('cp:contentStatus', props.contentStatus),
    text('dc:language', props.language),
  ].filter((x): x is XmlElement => x !== undefined);
  return el(
    'cp:coreProperties',
    {
      'xmlns:cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:dcterms': 'http://purl.org/dc/terms/',
      'xmlns:dcmitype': 'http://purl.org/dc/dcmitype/',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    },
    kids,
  );
}

function writeApp(deck: Deck): XmlElement {
  const p = deck.properties;
  const version = p.appVersion && /^\d{1,2}\.\d{4}$/.test(p.appVersion) ? p.appVersion : '16.0000';
  const kids = [
    el('TotalTime', {}, ['0']),
    el('Application', {}, [p.application ?? STRINGS.application]),
    el('PresentationFormat', {}, [deck.size.type && deck.size.type !== 'custom' ? deck.size.type : 'Personnalisé']),
    el('Slides', {}, [String(deck.slides.length)]),
    el('Notes', {}, [String(deck.slides.filter((s) => s.notes?.length).length)]),
    el('HiddenSlides', {}, [String(deck.slides.filter((s) => s.hidden).length)]),
  ];
  if (p.manager) kids.push(el('Manager', {}, [p.manager]));
  if (p.company) kids.push(el('Company', {}, [p.company]));
  kids.push(el('AppVersion', {}, [version]));
  return el('Properties', { xmlns: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties', 'xmlns:vt': 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes' }, kids);
}

function writeCustom(custom: Record<string, string>): XmlElement {
  return el(
    'Properties',
    { xmlns: 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties', 'xmlns:vt': 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes' },
    Object.entries(custom).map(([name, value], i) => el('property', { fmtid: '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}', pid: i + 2, name }, [el('vt:lpwstr', {}, [value])])),
  );
}

// ---- Presentation ----

/** Ecrit la presentation au format OOXML. */
export async function writePptx(deck: Deck, options: WriteOptions = {}): Promise<Uint8Array> {
  const format = options.format ?? deck.format;
  const writer = new PackageWriter();
  const paths = new PathAllocator();
  const state: WriterState = { deck, writer, paths, emitter: new PartEmitter(writer, paths), slidePaths: new Map(), mediaPaths: new Map(), pending: [] };
  const main = paths.reserve('ppt/presentation.xml');
  const ctx = new PartWriteContext(state, main);
  writer.addRelationship('', RT.officeDocument, main);

  // Chemins reserves d'abord : les liens entre parties peuvent viser une partie pas encore ecrite.
  const masterPaths = deck.masters.map((_, i) => paths.reserve(`ppt/slideMasters/slideMaster${i + 1}.xml`));
  const themePaths = deck.masters.map((_, i) => paths.reserve(`ppt/theme/theme${i + 1}.xml`));
  const layoutPaths = new Map<string, string>();
  let layoutNumber = 1;
  for (const master of deck.masters) for (const layout of master.layouts) layoutPaths.set(layout.id, paths.reserve(`ppt/slideLayouts/slideLayout${layoutNumber++}.xml`));
  deck.slides.forEach((slide, i) => state.slidePaths.set(slide.id, paths.reserve(`ppt/slides/slide${i + 1}.xml`)));
  const hasNotes = deck.slides.some((s) => s.notes?.length);
  const notesMasterPath = hasNotes ? paths.reserve('ppt/notesMasters/notesMaster1.xml') : undefined;
  const notesThemePath = hasNotes ? paths.reserve(`ppt/theme/theme${deck.masters.length + 1}.xml`) : undefined;

  const ids: IdCounter = { next: 2147483648 };
  const masterEntries = deck.masters.map((master, i) => {
    const path = masterPaths[i] as string;
    const entry = el('p:sldMasterId', { id: ids.next++, 'r:id': ctx.addRel(RT.master, path) });
    writeMaster(state, master, path, themePaths[i] as string, layoutPaths, ids);
    return entry;
  });
  const firstLayout = layoutPaths.values().next().value as string | undefined;
  const authors: AuthorTable = { ids: new Map() };
  let notesNumber = 1;
  const slideEntries = deck.slides.map((slide) => {
    const path = state.slidePaths.get(slide.id) as string;
    const layoutPath = layoutPaths.get(slide.layoutId) ?? firstLayout ?? '';
    const notes = notesMasterPath && slide.notes?.length ? { master: notesMasterPath, path: paths.reserve(`ppt/notesSlides/notesSlide${notesNumber++}.xml`) } : undefined;
    writeSlide(state, slide, path, layoutPath, notes, authors);
    return el('p:sldId', { id: slide.id, 'r:id': ctx.addRel(RT.slide, path) });
  });
  const kids: XmlElement[] = [el('p:sldMasterIdLst', {}, masterEntries)];
  if (notesMasterPath && notesThemePath) {
    writeNotesMaster(state, deck, notesMasterPath, notesThemePath);
    kids.push(el('p:notesMasterIdLst', {}, [el('p:notesMasterId', { 'r:id': ctx.addRel(RT.notesMaster, notesMasterPath) })]));
  }
  if (slideEntries.length) kids.push(el('p:sldIdLst', {}, slideEntries));
  const sizeType = deck.size.type && deck.size.type !== 'custom' ? deck.size.type : undefined;
  kids.push(el('p:sldSz', { cx: ptToEmu(clampSlideDimension(deck.size.width)), cy: ptToEmu(clampSlideDimension(deck.size.height)), type: sizeType }));
  kids.push(el('p:notesSz', { cx: ptToEmu(deck.notesSize.width), cy: ptToEmu(deck.notesSize.height) }));
  kids.push(writeListStyle(deck.defaultTextStyle, ctx, 'p:defaultTextStyle'));
  if (deck.sections.length) {
    const sections = deck.sections.map((s) => el('p14:section', { name: s.name, id: s.id }, [el('p14:sldIdLst', {}, s.slideIds.filter((id) => state.slidePaths.has(id)).map((id) => el('p14:sldId', { id })))]));
    kids.push(el('p:extLst', {}, [el('p:ext', { uri: '{521415D9-36F7-43E2-AB2F-B90AF26B5E84}' }, [el('p14:sectionLst', {}, sections)])]));
  }

  const presProps = deck.preserved.presProps ? cloneXml(deck.preserved.presProps) : el('p:presentationPr');
  const viewProps = deck.preserved.viewProps ? cloneXml(deck.preserved.viewProps) : el('p:viewPr', {}, [el('p:gridSpacing', { cx: 76200, cy: 76200 })]);
  const tableStyles = deck.preserved.tableStyles ? cloneXml(deck.preserved.tableStyles) : el('a:tblStyleLst', { def: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}' });
  const propPath = (name: string): string => paths.reserve(`ppt/${name}.xml`);
  writer.addXml(propPath('presProps'), declareNamespaces(Object.assign(presProps, { attrs: { ...rootNamespaces('a', 'r', 'p'), ...presProps.attrs } })), CT.presProps);
  ctx.addRel(RT.presProps, 'ppt/presProps.xml');
  writer.addXml(propPath('viewProps'), declareNamespaces(Object.assign(viewProps, { attrs: { ...rootNamespaces('a', 'r', 'p'), ...viewProps.attrs } })), CT.viewProps);
  ctx.addRel(RT.viewProps, 'ppt/viewProps.xml');
  if (themePaths[0]) ctx.addRel(RT.theme, themePaths[0]);
  writer.addXml(propPath('tableStyles'), declareNamespaces(Object.assign(tableStyles, { attrs: { ...rootNamespaces('a'), ...tableStyles.attrs } })), CT.tableStyles);
  ctx.addRel(RT.tableStyles, 'ppt/tableStyles.xml');

  if (authors.ids.size) {
    const path = paths.reserve('ppt/commentAuthors.xml');
    const list = [...authors.ids.entries()].map(([name, a]) => el('p:cmAuthor', { id: a.id, name, initials: a.initials, lastIdx: a.lastIdx, clrIdx: a.id % 8 }));
    writer.addXml(path, root('p:cmAuthorLst', {}, list), CT.commentAuthors);
    ctx.addRel(RT.commentAuthors, path);
  }
  if (deck.macros && format.endsWith('m')) {
    const path = paths.reserve('ppt/vbaProject.bin');
    writer.addBytes(path, deck.macros, CT.vba);
    ctx.addRel(RT.vba, path);
  }
  writer.addXml(main, root('p:presentation', { saveSubsetFonts: '1', firstSlideNum: deck.firstSlideNumber, rtl: deck.rtl ? '1' : undefined }, kids), MAIN_TYPES[format]);

  writer.addXml(paths.reserve('docProps/core.xml'), writeCore(deck.properties), CT.core);
  writer.addRelationship('', RT.coreProps, 'docProps/core.xml');
  writer.addXml(paths.reserve('docProps/app.xml'), writeApp(deck), CT.app);
  writer.addRelationship('', RT.appProps, 'docProps/app.xml');
  if (deck.properties.custom && Object.keys(deck.properties.custom).length) {
    writer.addXml(paths.reserve('docProps/custom.xml'), writeCustom(deck.properties.custom), CT.custom);
    writer.addRelationship('', RT.customProps, 'docProps/custom.xml');
  }
  await Promise.all(state.pending);
  return writer.build();
}
