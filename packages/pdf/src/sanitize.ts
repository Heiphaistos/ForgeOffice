// Assainissement du document (sans DOM, testé) : inspecte puis supprime les informations masquées avant partage
// (métadonnées, scripts, pièces jointes, commentaires, signets). Les liens et les champs de formulaire sont conservés.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFStream, PDFString, type PDFObject } from '@cantoo/pdf-lib';

export type HiddenKind = 'metadata' | 'scripts' | 'attachments' | 'comments' | 'bookmarks';
export const HIDDEN_KINDS: readonly HiddenKind[] = ['metadata', 'scripts', 'attachments', 'comments', 'bookmarks'];

/** Nombre d'éléments trouvés pour chaque catégorie (0 = rien à supprimer). */
export type HiddenReport = Readonly<Record<HiddenKind, number>>;

const COMMENT_TYPES = new Set(['Text', 'Highlight', 'Underline', 'StrikeOut', 'Squiggly', 'FreeText', 'Square', 'Circle', 'Line', 'Ink', 'Stamp', 'Caret', 'Polygon', 'PolyLine', 'Popup']);
const INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];

const N = PDFName.of;

function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
}

const subtype = (annot: PDFDict): string => (annot.get(N('Subtype')) as PDFName | undefined)?.decodeText() ?? '';

/** Annotations de chaque page avec leur référence éventuelle. */
function* annotations(doc: PDFDocument): Generator<{ page: number; annots: PDFArray; index: number; dict: PDFDict }> {
  const pages = doc.getPages();
  for (let p = 0; p < pages.length; p++) {
    const annots = pages[p]?.node.lookupMaybe(N('Annots'), PDFArray);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const dict = annots.lookupMaybe(i, PDFDict);
      if (dict) yield { page: p, annots, index: i, dict };
    }
  }
}

function isJs(action: PDFObject | undefined, doc: PDFDocument): boolean {
  const d = action instanceof PDFRef ? doc.context.lookup(action) : action;
  return d instanceof PDFDict && (d.get(N('S')) as PDFName | undefined)?.decodeText() === 'JavaScript';
}

function namesTree(doc: PDFDocument, key: string): PDFDict | undefined {
  return doc.catalog.lookupMaybe(N('Names'), PDFDict)?.lookupMaybe(N(key), PDFDict);
}

function treeSize(tree: PDFDict | undefined): number {
  const names = tree?.lookupMaybe(N('Names'), PDFArray);
  const kids = tree?.lookupMaybe(N('Kids'), PDFArray);
  let n = names ? names.size() / 2 : 0;
  for (let i = 0; kids && i < kids.size(); i++) n += treeSize(kids.lookupMaybe(i, PDFDict));
  return n;
}

function outlineCount(doc: PDFDocument): number {
  const root = doc.catalog.lookupMaybe(N('Outlines'), PDFDict);
  const count = root?.lookup(N('Count'));
  if (count instanceof PDFNumber) return Math.abs(count.asNumber()) || (root?.has(N('First')) ? 1 : 0);
  return root?.has(N('First')) ? 1 : 0;
}

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const ref = doc.context.trailerInfo.Info;
  return ref ? doc.context.lookupMaybe(ref, PDFDict) : undefined;
}

/** Supprime du fichier les objets que plus rien n'atteint depuis le catalogue : sans cela, le texte retiré (script, pièce jointe,
 *  métadonnées XMP) resterait lisible dans les octets même s'il n'apparaît plus nulle part. */
function pruneUnreachable(doc: PDFDocument): void {
  const { context } = doc;
  const seen = new Set<PDFRef>();
  const todo: PDFObject[] = [context.trailerInfo.Root, context.trailerInfo.Info, context.trailerInfo.Encrypt].filter((o): o is PDFRef => o !== undefined);
  for (let o = todo.pop(); o !== undefined; o = todo.pop()) {
    if (o instanceof PDFRef) {
      if (seen.has(o)) continue;
      seen.add(o);
      const target = context.lookup(o);
      if (target) todo.push(target);
    } else if (o instanceof PDFDict) todo.push(...o.values());
    else if (o instanceof PDFArray) for (let i = 0; i < o.size(); i++) todo.push(o.get(i));
    else if (o instanceof PDFStream) todo.push(o.dict);
  }
  for (const [ref] of context.enumerateIndirectObjects()) if (!seen.has(ref)) context.delete(ref);
}

/** Ce que le document contient de masqué, par catégorie. */
export async function inspectHidden(bytes: Uint8Array): Promise<HiddenReport> {
  const doc = await load(bytes);
  const info = infoDict(doc);
  const filled = INFO_KEYS.filter((k) => {
    const v = info?.get(N(k));
    return v instanceof PDFString || v instanceof PDFHexString ? v.decodeText().trim() !== '' : v !== undefined;
  }).length;
  let scripts = treeSize(namesTree(doc, 'JavaScript'));
  if (isJs(doc.catalog.get(N('OpenAction')), doc)) scripts++;
  if (doc.catalog.has(N('AA'))) scripts++;
  let attachments = treeSize(namesTree(doc, 'EmbeddedFiles'));
  let comments = 0;
  for (const { dict } of annotations(doc)) {
    const t = subtype(dict);
    if (t === 'FileAttachment') attachments++;
    else if (COMMENT_TYPES.has(t)) comments++;
    if (isJs(dict.get(N('A')), doc) || dict.has(N('AA'))) scripts++;
  }
  return { metadata: filled + (doc.catalog.has(N('Metadata')) ? 1 : 0), scripts, attachments, comments, bookmarks: outlineCount(doc) };
}

/** Supprime les catégories demandées ; le reste du document est inchangé. */
export async function sanitize(bytes: Uint8Array, kinds: ReadonlySet<HiddenKind>): Promise<Uint8Array> {
  const doc = await load(bytes);
  if (kinds.has('metadata')) {
    const info = infoDict(doc);
    for (const k of INFO_KEYS) info?.delete(N(k));
    doc.catalog.delete(N('Metadata'));
  }
  const names = doc.catalog.lookupMaybe(N('Names'), PDFDict);
  if (kinds.has('scripts')) {
    names?.delete(N('JavaScript'));
    if (isJs(doc.catalog.get(N('OpenAction')), doc)) doc.catalog.delete(N('OpenAction'));
    doc.catalog.delete(N('AA'));
  }
  if (kinds.has('attachments')) names?.delete(N('EmbeddedFiles'));
  if (kinds.has('bookmarks')) doc.catalog.delete(N('Outlines'));
  // Retrait des annotations en partant de la fin (les index restent valables).
  const found = [...annotations(doc)].reverse();
  for (const { annots, index, dict } of found) {
    const t = subtype(dict);
    if ((kinds.has('attachments') && t === 'FileAttachment') || (kinds.has('comments') && COMMENT_TYPES.has(t))) annots.remove(index);
    else if (kinds.has('scripts')) {
      if (isJs(dict.get(N('A')), doc)) dict.delete(N('A'));
      dict.delete(N('AA'));
    }
  }
  if (kinds.has('scripts')) for (const page of doc.getPages()) page.node.delete(N('AA'));
  pruneUnreachable(doc);
  return doc.save({ useObjectStreams: false });
}
