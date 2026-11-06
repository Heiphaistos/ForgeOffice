// SmartArt : lecture des noeuds de texte du graphe de donnees (partie dgm:dataModel) et modification du texte d'un noeud.
// La mise en page reste celle du dessin precalcule par Office (rendu de repli) ; son texte est mis a jour en meme temps.
import { children, child, descendants, parseXml, serializeXml, textOf, type XmlElement } from '@forgeoffice/opc';
import { flattenShapes, paragraphsFromText, textOfBody } from './edit.ts';
import type { SmartArtNode, SmartArtShape } from './model.ts';

const paragraphTexts = (pt: XmlElement): string =>
  [...descendants(child(pt, 'dgm:t') ?? pt, 'a:p')].map((p) => [...descendants(p, 'a:t')].map(textOf).join('')).join('\n');

/** Noeuds de texte d'un graphe SmartArt, dans l'ordre de la hierarchie (parents avant enfants). */
export function readSmartArtNodes(bytes: Uint8Array): SmartArtNode[] {
  let root: XmlElement;
  try {
    root = parseXml(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return [];
  }
  const points = children(child(root, 'dgm:ptLst'), 'dgm:pt');
  const byId = new Map(points.map((p) => [p.attrs.modelId ?? '', p]));
  const isNode = (p: XmlElement | undefined): p is XmlElement => !!p && (p.attrs.type === undefined || p.attrs.type === 'node' || p.attrs.type === 'asst');
  const kids = new Map<string, Array<{ id: string; order: number }>>();
  for (const cxn of children(child(root, 'dgm:cxnLst'), 'dgm:cxn')) {
    if (cxn.attrs.type !== undefined && cxn.attrs.type !== 'parOf') continue;
    const src = cxn.attrs.srcId ?? '';
    const dest = cxn.attrs.destId ?? '';
    if (!isNode(byId.get(dest))) continue;
    kids.set(src, [...(kids.get(src) ?? []), { id: dest, order: Number(cxn.attrs.srcOrd ?? 0) }]);
  }
  const out: SmartArtNode[] = [];
  const seen = new Set<string>();
  const visit = (id: string, parentId: string | undefined, depth: number): void => {
    if (seen.has(id) || depth > 64 || out.length > 5000) return;
    seen.add(id);
    const pt = byId.get(id);
    if (isNode(pt)) out.push(parentId ? { id, text: paragraphTexts(pt), parentId } : { id, text: paragraphTexts(pt) });
    for (const k of [...(kids.get(id) ?? [])].sort((a, b) => a.order - b.order)) visit(k.id, isNode(pt) ? id : undefined, depth + 1);
  };
  const doc = points.find((p) => p.attrs.type === 'doc');
  if (doc?.attrs.modelId) visit(doc.attrs.modelId, undefined, 0);
  // Noeuds non relies a la racine (graphe incomplet) : ajoutes dans l'ordre du fichier.
  for (const p of points) if (isNode(p) && !seen.has(p.attrs.modelId ?? '')) out.push({ id: p.attrs.modelId ?? '', text: paragraphTexts(p) });
  return out;
}

/**
 * Remplace le texte d'un noeud (lignes separees par \n) dans la partie de donnees conservee et dans le dessin de repli.
 * Renvoie false si le noeud est introuvable.
 */
export function setSmartArtNodeText(shape: SmartArtShape, nodeId: string, text: string): boolean {
  const node = shape.nodes?.find((n) => n.id === nodeId);
  const part = shape.raw.rels.find((r) => r.type.endsWith('/diagramData'))?.part;
  if (!node || !part) return false;
  const root = parseXml(new TextDecoder('utf-8').decode(part.bytes));
  const pt = children(child(root, 'dgm:ptLst'), 'dgm:pt').find((p) => p.attrs.modelId === nodeId);
  const body = child(pt, 'dgm:t');
  if (!pt || !body) return false;
  const firstRun = [...descendants(body, 'a:r')][0];
  const rPr = child(firstRun, 'a:rPr') ?? { name: 'a:rPr', attrs: { lang: 'fr-FR' }, children: [] };
  body.children = [
    ...body.children.filter((n) => typeof n !== 'string' && n.name !== 'a:p'),
    ...text.split('\n').map((line): XmlElement => ({ name: 'a:p', attrs: {}, children: line ? [{ name: 'a:r', attrs: {}, children: [structuredClone(rPr), { name: 'a:t', attrs: {}, children: [line] }] }] : [] })),
  ];
  const prSet = child(pt, 'dgm:prSet');
  if (prSet && text) delete prSet.attrs.phldr;
  part.bytes = new TextEncoder().encode(serializeXml(root));
  // Dessin de repli : les formes qui affichaient l'ancien texte affichent le nouveau.
  for (const s of flattenShapes(shape.fallback)) {
    if (s.kind === 'shape' && s.text && node.text !== '' && textOfBody(s.text) === node.text) {
      const props = s.text.paragraphs[0]?.runs.find((r) => r.type === 'text')?.props ?? {};
      s.text.paragraphs = paragraphsFromText(text, props);
    }
  }
  node.text = text;
  return true;
}
