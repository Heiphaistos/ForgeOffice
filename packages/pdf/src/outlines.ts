// Signets editables (sans DOM, teste) : arbre ajouter / renommer / supprimer / deplacer, et reecriture de /Outlines avec pdf-lib.
// Les destinations ecrites sont « page entiere » (/Fit) : la position fine et le style d'un signet d'origine ne sont pas conserves.
import { PDFDocument, PDFHexString, PDFName, PDFRef } from '@cantoo/pdf-lib';

export interface Bookmark {
  title: string;
  /** Page de destination (0-based) ou null. */
  page: number | null;
  children: Bookmark[];
}

/** Chemin d'un signet dans l'arbre : indices successifs. */
export type BookmarkPath = readonly number[];

const clone = (b: readonly Bookmark[]): Bookmark[] => b.map((x) => ({ ...x, children: clone(x.children) }));

function listAt(tree: Bookmark[], parent: BookmarkPath): Bookmark[] | null {
  let list = tree;
  for (const i of parent) {
    const node = list[i];
    if (!node) return null;
    list = node.children;
  }
  return list;
}

/** Ajoute un signet comme dernier enfant de `parent` (racine si vide). */
export function addBookmark(tree: readonly Bookmark[], parent: BookmarkPath, title: string, page: number): Bookmark[] {
  const next = clone(tree);
  listAt(next, parent)?.push({ title, page, children: [] });
  return next;
}

export function renameBookmark(tree: readonly Bookmark[], path: BookmarkPath, title: string): Bookmark[] {
  const next = clone(tree);
  const node = listAt(next, path.slice(0, -1))?.[path[path.length - 1] ?? -1];
  if (node) node.title = title;
  return next;
}

export function removeBookmark(tree: readonly Bookmark[], path: BookmarkPath): Bookmark[] {
  const next = clone(tree);
  listAt(next, path.slice(0, -1))?.splice(path[path.length - 1] ?? -1, 1);
  return next;
}

/** Change la page de destination d'un signet. */
export function setBookmarkPage(tree: readonly Bookmark[], path: BookmarkPath, page: number): Bookmark[] {
  const next = clone(tree);
  const node = listAt(next, path.slice(0, -1))?.[path[path.length - 1] ?? -1];
  if (node) node.page = page;
  return next;
}

/** Monte (-1) ou descend (+1) un signet parmi ses freres. Retourne l'arbre et le nouveau chemin. */
export function moveBookmark(tree: readonly Bookmark[], path: BookmarkPath, delta: -1 | 1): { tree: Bookmark[]; path: BookmarkPath } {
  const next = clone(tree);
  const list = listAt(next, path.slice(0, -1));
  const i = path[path.length - 1] ?? -1;
  const j = i + delta;
  if (!list || i < 0 || i >= list.length || j < 0 || j >= list.length) return { tree: next, path };
  const [moved] = list.splice(i, 1);
  if (moved) list.splice(j, 0, moved);
  return { tree: next, path: [...path.slice(0, -1), j] };
}

/** Remplace /Outlines par l'arbre donne (supprime l'entree s'il est vide). */
export async function writeOutline(bytes: Uint8Array, tree: readonly Bookmark[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const catalog = doc.catalog;
  if (tree.length === 0) {
    catalog.delete(PDFName.of('Outlines'));
    return doc.save({ useObjectStreams: true });
  }
  const rootRef = doc.context.nextRef();
  const build = (nodes: readonly Bookmark[], parent: PDFRef): { first: PDFRef; last: PDFRef; count: number } => {
    const refs = nodes.map(() => doc.context.nextRef());
    let count = nodes.length;
    nodes.forEach((n, i) => {
      const target = n.page === null ? undefined : pages[Math.min(Math.max(n.page, 0), pages.length - 1)];
      const kids = n.children.length > 0 ? build(n.children, refs[i] as PDFRef) : null;
      count += kids?.count ?? 0;
      const dict = doc.context.obj({
        Title: PDFHexString.fromText(n.title), Parent: parent,
        ...(target ? { Dest: [target.ref, 'Fit'] } : {}),
        ...(i > 0 ? { Prev: refs[i - 1] } : {}), ...(i < nodes.length - 1 ? { Next: refs[i + 1] } : {}),
        ...(kids ? { First: kids.first, Last: kids.last, Count: kids.count } : {}),
      });
      doc.context.assign(refs[i] as PDFRef, dict);
    });
    return { first: refs[0] as PDFRef, last: refs[refs.length - 1] as PDFRef, count };
  };
  const top = build(tree, rootRef);
  doc.context.assign(rootRef, doc.context.obj({ Type: 'Outlines', First: top.first, Last: top.last, Count: top.count }));
  catalog.set(PDFName.of('Outlines'), rootRef);
  return doc.save({ useObjectStreams: true });
}
