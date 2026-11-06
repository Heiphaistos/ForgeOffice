// Lecture d'un fichier .docx / .docm / .dotx / .dotm : tolerante (avertissements plutot qu'echec).
import {
  attr, child, children, OpcPackage, PackageError, parseXml, type PackageLimits, type XmlElement, DEFAULT_LIMITS,
} from '@forgeoffice/opc';
import type {
  Block, Comment, MediaItem, Note, Paragraph, ReadResult, StoredPart, StoredRel, WordDocument, WordFileKind,
} from '../model.ts';
import { createBlankDocument, createBuiltinStyles } from '../blank.ts';
import { Budget, DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from '../security.ts';
import { ERRORS, WARNINGS } from '../strings.ts';
import { CT, REL, sniffImageType } from './ns.ts';
import { parseBlocks, type PartContext } from './read-body.ts';
import { parseSection } from './read-props.ts';
import { extractDecorations } from './watermark.ts';
import {
  parseAppProps, parseCommentsExtended, parseCoreProps, parseCustomProps, parseFonts, parseNumbering, parseSettings,
  parseStyles, parseTheme,
} from './read-parts.ts';

export class DocxError extends Error {}

export interface ReadDocxOptions {
  limits?: Partial<ReadLimits>;
  /** Limites du conteneur zip (bombe zip). */
  packageLimits?: Partial<PackageLimits>;
}

const tail = (type: string): string => type.slice(type.lastIndexOf('/') + 1);

/** Relations dont le contenu est modelise : leurs parties ne sont pas conservees a part. */
const MODELED = new Set(['styles', 'numbering', 'theme', 'settings', 'webSettings', 'fontTable', 'footnotes', 'endnotes',
  'comments', 'commentsExtended', 'commentsIds', 'commentsExtensible', 'stylesWithEffects', 'header', 'footer', 'image',
  'hyperlink', 'chart', 'diagramData', 'diagramLayout', 'diagramQuickStyle', 'diagramColors', 'diagramDrawing', 'oleObject',
  'package', 'video', 'audio', 'media', 'control', 'officeDocument', 'core-properties', 'extended-properties',
  'custom-properties', 'thumbnail']);

class Loader {
  private readonly stored = new Map<string, StoredPart>();
  readonly pkg: OpcPackage;
  readonly warnings: Warnings;

  constructor(pkg: OpcPackage, warnings: Warnings) {
    this.pkg = pkg;
    this.warnings = warnings;
  }

  /** Charge une partie et ses relations (recursif, borne). */
  async part(path: string, depth = 0): Promise<StoredPart | undefined> {
    const cached = this.stored.get(path);
    if (cached) return cached;
    if (!this.pkg.has(path) || depth > 6) return undefined;
    const part: StoredPart = { path, contentType: this.pkg.contentType(path) ?? 'application/octet-stream', bytes: await this.pkg.readBytes(path), rels: [] };
    this.stored.set(path, part);
    part.rels = await this.rels(path, depth + 1);
    return part;
  }

  async rels(source: string, depth = 0): Promise<StoredRel[]> {
    const out: StoredRel[] = [];
    let list;
    try {
      list = await this.pkg.relationships(source);
    } catch (error) {
      this.warnings.add('part-unreadable', WARNINGS.partUnreadable(`${source}.rels`));
      if (error instanceof PackageError && /volumineux/.test(error.message)) throw error;
      return out;
    }
    for (const rel of list) {
      const stored: StoredRel = { id: rel.id, type: rel.type, target: rel.target, external: rel.external };
      if (!rel.external && !['header', 'footer', 'styles', 'numbering', 'footnotes', 'endnotes', 'comments', 'settings', 'theme', 'fontTable', 'officeDocument'].includes(tail(rel.type))) {
        const part = await this.part(rel.target, depth);
        if (part) stored.part = part;
      }
      out.push(stored);
    }
    return out;
  }
}

class DocxReader {
  readonly doc: WordDocument = createBlankDocument();
  readonly warnings = new Warnings();
  readonly budget: Budget;
  private readonly loader: Loader;
  private readonly mediaByPath = new Map<string, string>();
  readonly pkg: OpcPackage;

  constructor(pkg: OpcPackage, limits: ReadLimits) {
    this.pkg = pkg;
    this.budget = new Budget(limits, this.warnings);
    this.loader = new Loader(pkg, this.warnings);
  }

  /** Execute `fn` sur une partie XML ; avertit au lieu d'echouer. */
  async xml<T>(path: string | undefined, fn: (root: XmlElement, raw: string) => T | Promise<T>): Promise<T | undefined> {
    if (!path || !this.pkg.has(path)) return undefined;
    try {
      const raw = await this.pkg.readText(path);
      return await fn(parseXml(raw), raw);
    } catch (error) {
      if (error instanceof PackageError && /volumineux/.test(error.message)) throw error;
      this.warnings.add('part-unreadable', WARNINGS.partUnreadable(path));
      return undefined;
    }
  }

  private media(part: StoredPart): string {
    const known = this.mediaByPath.get(part.path);
    if (known) return known;
    const fileName = part.path.slice(part.path.lastIndexOf('/') + 1);
    let id = fileName;
    for (let n = 2; this.doc.media[id]; n++) id = `${n}-${fileName}`;
    const declared = part.contentType.startsWith('image/') ? part.contentType : undefined;
    const item: MediaItem = { id, fileName, contentType: declared ?? sniffImageType(part.bytes) ?? 'application/octet-stream', bytes: part.bytes };
    this.doc.media[id] = item;
    this.mediaByPath.set(part.path, id);
    return id;
  }

  /** Contexte d'une partie de contenu : relations chargees, images enregistrees comme medias. */
  async context(partPath: string, headerIds = new Map<string, string>()): Promise<{ ctx: PartContext; rels: StoredRel[] }> {
    const rels = await this.loader.rels(partPath);
    const map = new Map(rels.map((r) => [r.id, r]));
    const images = new Map<string, string>();
    for (const rel of rels) if (tail(rel.type) === 'image' && rel.part) images.set(rel.id, this.media(rel.part));
    return { ctx: { rels: map, images, headerIds, budget: this.budget, warnings: this.warnings }, rels };
  }

  async blocksOf(partPath: string, select: (root: XmlElement) => XmlElement | undefined): Promise<Block[]> {
    const { ctx } = await this.context(partPath);
    return (await this.xml(partPath, (root) => {
      const container = select(root);
      return container ? parseBlocks(container, ctx, 0) : [];
    })) ?? [];
  }

  async notes(partPath: string | undefined, tag: string): Promise<Note[]> {
    if (!partPath) return [];
    const { ctx } = await this.context(partPath);
    return (await this.xml(partPath, (root) => children(root, tag).map((n) => {
      const type = attr(n, 'w:type');
      const note: Note = { id: Number(attr(n, 'w:id') ?? 0), blocks: parseBlocks(n, ctx, 1) };
      if (type === 'separator' || type === 'continuationSeparator' || type === 'continuationNotice') note.special = type;
      return note;
    }))) ?? [];
  }

  async comments(partPath: string | undefined, extendedPath: string | undefined): Promise<Comment[]> {
    if (!partPath) return [];
    const { ctx } = await this.context(partPath);
    const extended = (await this.xml(extendedPath, parseCommentsExtended)) ?? new Map();
    const comments = (await this.xml(partPath, (root) => children(root, 'w:comment').map((c): Comment => {
      const comment: Comment = { id: Number(attr(c, 'w:id') ?? 0), author: attr(c, 'w:author') ?? '', blocks: parseBlocks(c, ctx, 1) };
      const initials = attr(c, 'w:initials');
      const date = attr(c, 'w:date');
      if (initials) comment.initials = initials;
      if (date) comment.date = date;
      return comment;
    }))) ?? [];
    // Fil de discussion : le paraId du dernier paragraphe identifie le commentaire.
    const byParaId = new Map<string, Comment>();
    for (const comment of comments) {
      const paragraphs = comment.blocks.filter((b): b is Paragraph => b.type === 'paragraph');
      const paraId = paragraphs[paragraphs.length - 1]?.paraId;
      if (paraId) byParaId.set(paraId, comment);
    }
    for (const [paraId, info] of extended) {
      const comment = byParaId.get(paraId);
      if (!comment) continue;
      if (info.done) comment.done = true;
      const parent = info.parent ? byParaId.get(info.parent) : undefined;
      if (parent) comment.parentId = parent.id;
    }
    return comments;
  }
}

function kindOf(contentType: string | undefined): WordFileKind {
  switch (contentType) {
    case CT.documentMacro: return 'docm';
    case CT.template: return 'dotx';
    case CT.templateMacro: return 'dotm';
    default: return 'docx';
  }
}

/** Recupere le texte d'un document.xml abime (balises w:t entre les fins de paragraphes). */
function salvageText(raw: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of raw.split(/<\/w:p>/)) {
    const pieces = [...chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '');
    if (!pieces.length) continue;
    const text = pieces.join('').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    blocks.push({ type: 'paragraph', props: {}, inlines: [{ type: 'text', text, props: {} }] });
  }
  return blocks;
}

/** Lit un document Word Open XML. Leve DocxError si le fichier n'est pas une archive Word exploitable. */
export async function readDocx(bytes: Uint8Array, options: ReadDocxOptions = {}): Promise<ReadResult> {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  if (bytes.length > limits.maxInputBytes) throw new DocxError(ERRORS.tooLarge);
  let pkg: OpcPackage;
  try {
    pkg = await OpcPackage.open(bytes, { ...DEFAULT_LIMITS, ...options.packageLimits });
  } catch (error) {
    throw new DocxError(error instanceof PackageError && /fichiers/.test(error.message) ? error.message : ERRORS.notZip);
  }
  try {
    return await readPackage(pkg, limits);
  } catch (error) {
    if (error instanceof PackageError) throw new DocxError(error.message);
    throw error;
  }
}

async function readPackage(pkg: OpcPackage, limits: ReadLimits): Promise<ReadResult> {
  const reader = new DocxReader(pkg, limits);
  const { doc, warnings } = reader;
  const mainPath = (await pkg.relatedPart('', '/officeDocument'))
    ?? pkg.findByContentType(CT.document) ?? pkg.findByContentType(CT.documentMacro)
    ?? pkg.findByContentType(CT.template) ?? pkg.findByContentType(CT.templateMacro)
    ?? (pkg.has('word/document.xml') ? 'word/document.xml' : undefined);
  if (!mainPath || !pkg.has(mainPath)) throw new DocxError(WARNINGS.noMainPart);
  doc.kind = kindOf(pkg.contentType(mainPath));

  // Proprietes du paquet.
  const packageRels = await pkg.relationships('');
  const relPath = (suffix: string): string | undefined => packageRels.find((r) => !r.external && r.type.endsWith(suffix))?.target;
  await reader.xml(relPath('/core-properties') ?? 'docProps/core.xml', (root) => parseCoreProps(root, doc.properties));
  await reader.xml(relPath('/extended-properties') ?? 'docProps/app.xml', (root) => parseAppProps(root, doc.properties));
  await reader.xml(relPath('/custom-properties'), (root) => parseCustomProps(root, doc.properties));

  // Parties liees au document principal.
  const { ctx, rels } = await reader.context(mainPath);
  const target = (name: string): string | undefined => rels.find((r) => !r.external && tail(r.type) === name)?.target;
  await reader.xml(target('theme'), (root, raw) => { doc.theme = parseTheme(raw, root); });
  doc.settings = (await reader.xml(target('settings'), parseSettings)) ?? doc.settings;
  const styles = await reader.xml(target('styles'), parseStyles);
  doc.styles = styles ?? {
    docDefaults: { run: { font: 'Times New Roman', size: 10 }, paragraph: {} },
    styles: createBuiltinStyles().filter((s) => s.isDefault).map((s) => (s.id === 'Normal' ? { ...s, paragraph: {}, run: {} } : s)),
  };
  doc.numbering = (await reader.xml(target('numbering'), parseNumbering)) ?? doc.numbering;
  doc.fonts = (await reader.xml(target('fontTable'), parseFonts)) ?? doc.fonts;

  // En-tetes et pieds de page.
  for (const rel of rels) {
    const kind = tail(rel.type);
    if ((kind !== 'header' && kind !== 'footer') || rel.external) continue;
    const id = rel.target.slice(rel.target.lastIndexOf('/') + 1).replace(/\.xml$/i, '');
    ctx.headerIds.set(rel.id, id);
    const blocks = await reader.blocksOf(rel.target, (root) => root);
    doc.headersFooters[id] = { id, kind, blocks };
  }

  doc.footnotes = await reader.notes(target('footnotes'), 'w:footnote');
  doc.endnotes = await reader.notes(target('endnotes'), 'w:endnote');
  doc.comments = await reader.comments(target('comments'), target('commentsExtended'));

  // Corps.
  let body: XmlElement | undefined;
  let backgroundColor: string | undefined;
  try {
    const root = parseXml(await pkg.readText(mainPath));
    body = child(root, 'w:body');
    backgroundColor = attr(child(root, 'w:background'), 'w:color');
  } catch (error) {
    if (error instanceof PackageError) throw error;
    warnings.add('main-repaired', WARNINGS.mainRepaired);
    doc.body = salvageText(await pkg.readText(mainPath));
  }
  if (body) {
    doc.body = parseBlocks(body, ctx, 0);
    doc.finalSection = parseSection(child(body, 'w:sectPr'), (rid) => ctx.headerIds.get(rid));
  }
  Object.assign(doc.properties.custom, extractDecorations(doc.headersFooters, backgroundColor));
  if (!doc.body.length) doc.body = [{ type: 'paragraph', props: {}, inlines: [] }];

  // Parties non modelisees conservees (customXml, macros, glossaire...).
  for (const rel of rels) if (!MODELED.has(tail(rel.type))) doc.preserved.push({ source: 'document', rel });
  for (const rel of packageRels) {
    if (MODELED.has(tail(rel.type))) continue;
    const stored: StoredRel = { id: rel.id, type: rel.type, target: rel.target, external: rel.external };
    if (!rel.external) {
      const loader = new Loader(pkg, warnings);
      const part = await loader.part(rel.target);
      if (part) stored.part = part;
    }
    doc.preserved.push({ source: 'package', rel: stored });
  }
  return { document: doc, warnings: warnings.list };
}

/** Vrai si les octets ressemblent a une archive zip (PK\x03\x04). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
}
