// SmartArt simple : liste, processus, hierarchie. Des formes generees (rectangles arrondis, fleches, traits) groupees
// dans un groupe nomme « SmartArt » ; le texte reste editable forme par forme, ou par la saisie de la liste.
import type { AutoShape, Color, GroupShape, Shape, Transform } from '@forgeoffice/pptx';

export type SmartArtKind = 'list' | 'process' | 'hierarchy';

export const SMARTART_NAME = 'SmartArt';
export const SMARTART_KINDS: readonly SmartArtKind[] = ['list', 'process', 'hierarchy'];
const MARK = 'smartart:';
const MAX_ITEMS = 40;

export interface SmartArtItem {
  text: string;
  /** Niveau (hierarchie : 0 = racine). */
  level: number;
}

const accent = (n: number): Color => ({ type: 'scheme', value: `accent${n}` as 'accent1' });
const white: Color = { type: 'scheme', value: 'bg1' };

/** Saisie : une ligne par element, retrait (tabulations ou 2 espaces) = niveau. Lignes vides ignorees. */
export function parseItems(text: string): SmartArtItem[] {
  const items: SmartArtItem[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^[\t ]*/)?.[0] ?? '';
    const level = (indent.match(/\t/g)?.length ?? 0) + Math.floor(indent.replace(/\t/g, '').length / 2);
    items.push({ text: raw.trim().slice(0, 200), level: Math.min(level, 4) });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export function itemsToText(items: readonly SmartArtItem[]): string {
  return items.map((i) => `${'\t'.repeat(i.level)}${i.text}`).join('\n');
}

function box(id: number, name: string, preset: string, xfrm: Transform, text: string | null, fill: Color | null, size: number): AutoShape {
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name,
    xfrm,
    geometry: { type: 'preset', preset },
    fill: fill ? { type: 'solid', color: fill } : { type: 'none' },
    line: fill ? { fill: { type: 'solid', color: { type: 'scheme', value: 'bg1' } }, width: 1 } : undefined,
  };
  if (text !== null) {
    shape.text = {
      props: { anchor: 'ctr', wrap: true, autofit: { type: 'normal' }, insets: { left: 6, right: 6, top: 3, bottom: 3 } },
      paragraphs: [{ props: { align: 'ctr' }, runs: text ? [{ type: 'text', text, props: { size, color: white, lang: 'fr-FR' } }] : [], endProps: { size, color: white } }],
    };
  }
  return shape;
}

const line = (id: number, x1: number, y1: number, x2: number, y2: number): AutoShape => ({
  kind: 'shape',
  id,
  name: 'Trait',
  xfrm: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
  geometry: { type: 'preset', preset: 'line' },
  line: { fill: { type: 'solid', color: { type: 'scheme', value: 'tx2' } }, width: 1.5 },
});

function fontFor(w: number, h: number, text: string): number {
  const byHeight = h * 0.42;
  const byWidth = (w * 1.7) / Math.max(6, text.length);
  return Math.max(9, Math.min(28, Math.round(Math.min(byHeight, Math.max(byWidth, 12)))));
}

function listShapes(items: readonly SmartArtItem[], area: Transform, first: number): Shape[] {
  const n = items.length;
  const gap = 10;
  const h = Math.min(70, (area.height - gap * (n - 1)) / n);
  const total = h * n + gap * (n - 1);
  const y0 = area.y + (area.height - total) / 2;
  return items.map((it, i) => box(first + i, `Élément ${i + 1}`, 'roundRect', { x: area.x, y: y0 + i * (h + gap), width: area.width, height: h }, it.text, accent(1), fontFor(area.width, h, it.text)));
}

function processShapes(items: readonly SmartArtItem[], area: Transform, first: number): Shape[] {
  const n = items.length;
  const arrow = n > 1 ? Math.min(34, area.width / (n * 3)) : 0;
  const gap = 8;
  const w = (area.width - (arrow + gap * 2) * (n - 1)) / n;
  const h = Math.min(area.height, Math.max(60, w * 0.8));
  const y = area.y + (area.height - h) / 2;
  const out: Shape[] = [];
  let id = first;
  items.forEach((it, i) => {
    const x = area.x + i * (w + arrow + gap * 2);
    out.push(box(id++, `Étape ${i + 1}`, 'roundRect', { x, y, width: w, height: h }, it.text, accent(1 + (i % 2 ? 1 : 0)), fontFor(w, h, it.text)));
    if (i < n - 1) out.push(box(id++, `Flèche ${i + 1}`, 'rightArrow', { x: x + w + gap, y: y + h / 2 - arrow * 0.6, width: arrow, height: arrow * 1.2 }, null, { type: 'scheme', value: 'tx2', mods: [{ name: 'lumMod', val: 60000 }, { name: 'lumOff', val: 40000 }] }, 12));
  });
  return out;
}

interface TreeNode {
  item: SmartArtItem;
  children: TreeNode[];
  x: number;
  depth: number;
  leaves: number;
}

function buildTree(items: readonly SmartArtItem[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const item of items) {
    const node: TreeNode = { item, children: [], x: 0, depth: 0, leaves: 1 };
    const level = Math.min(item.level, stack.length);
    stack.length = level;
    const parent = stack[level - 1];
    if (parent) {
      parent.children.push(node);
      node.depth = parent.depth + 1;
    } else roots.push(node);
    stack.push(node);
  }
  return roots;
}

function countLeaves(n: TreeNode): number {
  n.leaves = n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
  return n.leaves;
}

function hierarchyShapes(items: readonly SmartArtItem[], area: Transform, first: number): Shape[] {
  // Plusieurs racines : elles deviennent les enfants d'une racine implicite (la premiere).
  let roots = buildTree(items);
  if (roots.length > 1) {
    const [head, ...rest] = roots as [TreeNode, ...TreeNode[]];
    head.children.push(...rest);
    const bump = (n: TreeNode, d: number): void => {
      n.depth = d;
      n.children.forEach((c) => bump(c, d + 1));
    };
    bump(head, 0);
    roots = [head];
  }
  const root = roots[0];
  if (!root) return [];
  const leaves = countLeaves(root);
  let maxDepth = 0;
  const all: TreeNode[] = [];
  const walk = (n: TreeNode): void => {
    all.push(n);
    maxDepth = Math.max(maxDepth, n.depth);
    n.children.forEach(walk);
  };
  walk(root);
  const colW = area.width / leaves;
  const levels = maxDepth + 1;
  const vGap = Math.min(36, area.height / (levels * 3));
  const h = Math.min(64, (area.height - vGap * (levels - 1)) / levels);
  const w = Math.min(colW * 0.86, 190);
  let cursor = 0;
  const place = (n: TreeNode): void => {
    if (!n.children.length) {
      n.x = area.x + (cursor + 0.5) * colW;
      cursor += 1;
      return;
    }
    n.children.forEach(place);
    const a = n.children[0] as TreeNode;
    const b = n.children[n.children.length - 1] as TreeNode;
    n.x = (a.x + b.x) / 2;
  };
  place(root);
  const yOf = (d: number): number => area.y + d * (h + vGap);
  const out: Shape[] = [];
  let id = first;
  // Traits d'abord (derriere les boites).
  for (const n of all) {
    if (!n.children.length) continue;
    const yBottom = yOf(n.depth) + h;
    const yMid = yBottom + vGap / 2;
    out.push(line(id++, n.x, yBottom, n.x, yMid));
    const xs = n.children.map((c) => c.x);
    if (xs.length > 1) out.push(line(id++, Math.min(...xs), yMid, Math.max(...xs), yMid));
    for (const c of n.children) out.push(line(id++, c.x, yMid, c.x, yOf(c.depth)));
  }
  all.forEach((n, i) => out.push(box(id++, n.depth === 0 ? 'Racine' : `Niveau ${n.depth + 1}.${i}`, 'roundRect', { x: n.x - w / 2, y: yOf(n.depth), width: w, height: h }, n.item.text, accent(n.depth === 0 ? 1 : n.depth === 1 ? 2 : 3), fontFor(w, h, n.item.text))));
  return out;
}

/** Groupe « SmartArt » (liste, processus ou hierarchie) place dans `area`. Les identifiants partent de `firstId`. */
export function buildSmartArt(kind: SmartArtKind, items: readonly SmartArtItem[], area: Transform, firstId: number): GroupShape {
  const clean = items.filter((i) => i.text.trim()).slice(0, MAX_ITEMS);
  if (!clean.length) throw new Error('Saisissez au moins un élément.');
  const children = kind === 'list' ? listShapes(clean, area, firstId + 1) : kind === 'process' ? processShapes(clean, area, firstId + 1) : hierarchyShapes(clean, area, firstId + 1);
  return {
    kind: 'group',
    id: firstId,
    name: SMARTART_NAME,
    title: `${MARK}${kind}`,
    description: `Graphique SmartArt (${kind === 'list' ? 'liste' : kind === 'process' ? 'processus' : 'hiérarchie'}) : ${clean.map((i) => i.text).join(', ')}`,
    xfrm: { ...area },
    childOffset: { x: area.x, y: area.y },
    childExtent: { width: area.width, height: area.height },
    children,
  };
}

/** Reconnait un SmartArt cree ici : type et elements (texte des formes, dans l'ordre de creation). */
export function readSmartArt(shape: Shape): { kind: SmartArtKind; items: SmartArtItem[] } | null {
  if (shape.kind !== 'group' || shape.name !== SMARTART_NAME || !shape.title?.startsWith(MARK)) return null;
  const kind = SMARTART_KINDS.find((k) => k === shape.title?.slice(MARK.length));
  if (!kind) return null;
  const boxes = shape.children.filter((c): c is AutoShape => c.kind === 'shape' && c.geometry.type === 'preset' && c.geometry.preset === 'roundRect');
  const textOf = (s: AutoShape): string => (s.text?.paragraphs ?? []).map((p) => p.runs.map((r) => (r.type === 'text' ? r.text : r.type === 'field' ? r.text : '')).join('')).join(' ');
  if (kind !== 'hierarchy') return { kind, items: boxes.map((b) => ({ text: textOf(b), level: 0 })) };
  // Hierarchie : niveau deduit de la ligne (ordonnee) occupee par la boite.
  const ys = [...new Set(boxes.map((b) => Math.round(b.xfrm?.y ?? 0)))].sort((a, b) => a - b);
  return { kind, items: boxes.map((b) => ({ text: textOf(b), level: Math.max(0, ys.indexOf(Math.round(b.xfrm?.y ?? 0))) })) };
}
