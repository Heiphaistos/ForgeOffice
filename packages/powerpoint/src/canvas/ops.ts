// Operations sur les formes d'une page (sans DOM) : reperes des groupes, deplacement, ordre, groupement,
// alignement, distribution, duplication, retournement. Les fonctions modifient la liste recue (brouillon clone par l'appelant).
import { nextShapeId, type GroupShape, type Shape, type Transform } from '@forgeoffice/pptx';
import { alignOffsets, boundsOf, center, distributeOffsets, normalizeAngle, rotatePoint, unionRects, type AlignMode, type Box, type Point, type Rect } from './math.ts';

/** Forme situee dans l'arbre : liste qui la contient, indice, groupes ancetres (du plus proche au plus lointain). */
export interface Located {
  shape: Shape;
  list: Shape[];
  index: number;
  ancestors: GroupShape[];
}

export function locate(shapes: Shape[], id: number, ancestors: GroupShape[] = []): Located | null {
  for (let index = 0; index < shapes.length; index++) {
    const shape = shapes[index] as Shape;
    if (shape.id === id) return { shape, list: shapes, index, ancestors };
    if (shape.kind === 'group') {
      const found = locate(shape.children, id, [shape, ...ancestors]);
      if (found) return found;
    }
  }
  return null;
}

export const boxOfXfrm = (x: Transform): Box => ({ x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation, flipH: x.flipH, flipV: x.flipV });

export function xfrmOfBox(b: Box): Transform {
  const out: Transform = { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) };
  const rotation = normalizeAngle(b.rotation ?? 0);
  if (rotation) out.rotation = Math.round(rotation * 100) / 100;
  if (b.flipH) out.flipH = true;
  if (b.flipV) out.flipV = true;
  return out;
}

/** Arrondi a l'EMU (precision du format). */
const round = (v: number): number => Math.round(v * 12700) / 12700;

function groupScale(g: GroupShape): { sx: number; sy: number } {
  const x = g.xfrm;
  const sx = x && g.childExtent.width ? x.width / g.childExtent.width : 1;
  const sy = x && g.childExtent.height ? x.height / g.childExtent.height : 1;
  return { sx, sy };
}

/** Boite d'un enfant (repere du groupe) vers le repere du parent du groupe. */
export function childToParent(g: GroupShape, b: Box): Box {
  const gx = g.xfrm;
  if (!gx) return b;
  const { sx, sy } = groupScale(g);
  const c = center(b);
  let px = gx.x + (c.x - g.childOffset.x) * sx;
  let py = gx.y + (c.y - g.childOffset.y) * sy;
  if (gx.flipH) px = 2 * gx.x + gx.width - px;
  if (gx.flipV) py = 2 * gx.y + gx.height - py;
  const p = rotatePoint({ x: px, y: py }, center(gx), gx.rotation ?? 0);
  const w = b.width * sx;
  const h = b.height * sy;
  const mirrored = (gx.flipH ?? false) !== (gx.flipV ?? false);
  const out: Box = { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rotation: normalizeAngle((mirrored ? -(b.rotation ?? 0) : b.rotation ?? 0) + (gx.rotation ?? 0)) };
  if ((b.flipH ?? false) !== (gx.flipH ?? false)) out.flipH = true;
  if ((b.flipV ?? false) !== (gx.flipV ?? false)) out.flipV = true;
  return out;
}

/** Inverse de childToParent. */
export function parentToChild(g: GroupShape, b: Box): Box {
  const gx = g.xfrm;
  if (!gx) return b;
  const { sx, sy } = groupScale(g);
  const p = rotatePoint(center(b), center(gx), -(gx.rotation ?? 0));
  let px = p.x;
  let py = p.y;
  if (gx.flipH) px = 2 * gx.x + gx.width - px;
  if (gx.flipV) py = 2 * gx.y + gx.height - py;
  const cx = (px - gx.x) / (sx || 1) + g.childOffset.x;
  const cy = (py - gx.y) / (sy || 1) + g.childOffset.y;
  const w = b.width / (sx || 1);
  const h = b.height / (sy || 1);
  const mirrored = (gx.flipH ?? false) !== (gx.flipV ?? false);
  const rel = (b.rotation ?? 0) - (gx.rotation ?? 0);
  const out: Box = { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rotation: normalizeAngle(mirrored ? -rel : rel) };
  if ((b.flipH ?? false) !== (gx.flipH ?? false)) out.flipH = true;
  if ((b.flipV ?? false) !== (gx.flipV ?? false)) out.flipV = true;
  return out;
}

/** Boite d'une forme dans la page (les groupes ancetres sont appliques). null si la forme n'a pas de position. */
export function pageBox(found: Pick<Located, 'shape' | 'ancestors'>): Box | null {
  if (!found.shape.xfrm) return null;
  let box = boxOfXfrm(found.shape.xfrm);
  for (const g of found.ancestors) box = childToParent(g, box);
  return box;
}

/** Ecrit une boite exprimee dans la page sur une forme (conversion dans le repere de ses groupes). */
export function setPageBox(found: Pick<Located, 'shape' | 'ancestors'>, box: Box): void {
  let local = box;
  for (let i = found.ancestors.length - 1; i >= 0; i--) local = parentToChild(found.ancestors[i] as GroupShape, local);
  const before = found.shape.xfrm;
  found.shape.xfrm = xfrmOfBox(local);
  if (before && (found.shape.kind === 'smartart' || found.shape.kind === 'raw')) fitFallback(found.shape.fallback, before, found.shape.xfrm);
  for (const g of found.ancestors) refitGroup(g);
}

/** Rendu de repli (SmartArt, objets conserves) en coordonnees de page : suit le cadre deplace ou redimensionne. */
function fitFallback(shapes: Shape[], from: Transform, to: Transform): void {
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  for (const s of shapes) {
    if (!s.xfrm) continue;
    s.xfrm = { ...s.xfrm, x: to.x + (s.xfrm.x - from.x) * sx, y: to.y + (s.xfrm.y - from.y) * sy, width: s.xfrm.width * sx, height: s.xfrm.height * sy };
  }
}

/** Recalcule l'etendue d'un groupe apres modification d'un enfant (la position des autres enfants est conservee). */
export function refitGroup(g: GroupShape): void {
  const gx = g.xfrm;
  if (!gx) return;
  const rects = g.children.filter((c) => c.xfrm).map((c) => boundsOf(boxOfXfrm(c.xfrm as Transform)));
  const b = unionRects(rects);
  if (!b || (b.x === g.childOffset.x && b.y === g.childOffset.y && b.width === g.childExtent.width && b.height === g.childExtent.height)) return;
  const { sx, sy } = groupScale(g);
  // Nouveau cadre du groupe dans le repere de son parent (rotation du groupe conservee).
  const before = { x: gx.x + (b.x - g.childOffset.x) * sx, y: gx.y + (b.y - g.childOffset.y) * sy, width: b.width * sx, height: b.height * sy };
  const oldCenter = center(gx);
  const c = rotatePoint(center(before), oldCenter, gx.rotation ?? 0);
  g.xfrm = { ...gx, x: round(c.x - before.width / 2), y: round(c.y - before.height / 2), width: round(before.width), height: round(before.height) };
  g.childOffset = { x: b.x, y: b.y };
  g.childExtent = { width: b.width, height: b.height };
}

/** Toutes les formes avec leur boite dans la page (groupes developpes), dans l'ordre de dessin. */
export function flattenWithBoxes(shapes: Shape[], ancestors: GroupShape[] = []): Array<{ shape: Shape; box: Box | null; ancestors: GroupShape[] }> {
  const out: Array<{ shape: Shape; box: Box | null; ancestors: GroupShape[] }> = [];
  for (const shape of shapes) {
    out.push({ shape, box: pageBox({ shape, ancestors }), ancestors });
    if (shape.kind === 'group') out.push(...flattenWithBoxes(shape.children, [shape, ...ancestors]));
  }
  return out;
}

/** Deplace des formes d'un vecteur exprime dans la page. */
export function moveShapes(shapes: Shape[], ids: readonly number[], dx: number, dy: number): void {
  for (const id of ids) {
    const found = locate(shapes, id);
    const box = found && pageBox(found);
    if (!found || !box) continue;
    setPageBox(found, { ...box, x: box.x + dx, y: box.y + dy });
  }
}

export function deleteShapes(shapes: Shape[], ids: readonly number[]): void {
  for (const id of ids) {
    const found = locate(shapes, id);
    if (!found) continue;
    found.list.splice(found.index, 1);
    const parent = found.ancestors[0];
    if (parent) {
      if (parent.children.length === 0) deleteShapes(shapes, [parent.id]);
      else refitGroup(parent);
    }
  }
}

/** Renumerote une forme (et ses enfants) a partir de `next`. Renvoie le prochain identifiant libre. */
export function renumber(shape: Shape, next: number): number {
  shape.id = next++;
  if (shape.kind === 'group') for (const child of shape.children) next = renumber(child, next);
  return next;
}

/** Duplique des formes (meme liste, juste au-dessus de l'original) decalees de `offset`. Renvoie les nouveaux identifiants. */
export function duplicateShapes(shapes: Shape[], ids: readonly number[], offset: Point): number[] {
  let next = nextShapeId(shapes);
  const created: number[] = [];
  for (const id of ids) {
    const found = locate(shapes, id);
    if (!found) continue;
    const copy = structuredClone(found.shape);
    delete copy.placeholder;
    next = renumber(copy, next);
    if (copy.xfrm) copy.xfrm = { ...copy.xfrm, x: copy.xfrm.x + offset.x, y: copy.xfrm.y + offset.y };
    found.list.push(copy);
    created.push(copy.id);
  }
  return created;
}

/** Insere des formes copiees (presse-papiers) avec des identifiants neufs. */
export function insertCopies(shapes: Shape[], copies: readonly Shape[], offset: Point): number[] {
  let next = nextShapeId(shapes);
  const created: number[] = [];
  for (const source of copies) {
    const copy = structuredClone(source);
    next = renumber(copy, next);
    if (copy.xfrm) copy.xfrm = { ...copy.xfrm, x: copy.xfrm.x + offset.x, y: copy.xfrm.y + offset.y };
    shapes.push(copy);
    created.push(copy.id);
  }
  return created;
}

export type OrderMove = 'front' | 'back' | 'forward' | 'backward';

/** Premier plan, arriere-plan, avancer, reculer (dans la liste qui contient chaque forme). */
export function reorder(shapes: Shape[], ids: readonly number[], move: OrderMove): void {
  const located = ids.map((id) => locate(shapes, id)).filter((f): f is Located => f !== null);
  const lists = new Set(located.map((f) => f.list));
  for (const list of lists) {
    const chosen = new Set(located.filter((f) => f.list === list).map((f) => f.shape));
    if (move === 'front' || move === 'back') {
      const kept = list.filter((s) => !chosen.has(s));
      const moved = list.filter((s) => chosen.has(s));
      list.splice(0, list.length, ...(move === 'front' ? [...kept, ...moved] : [...moved, ...kept]));
    } else if (move === 'forward') {
      for (let i = list.length - 2; i >= 0; i--) {
        if (chosen.has(list[i] as Shape) && !chosen.has(list[i + 1] as Shape)) [list[i], list[i + 1]] = [list[i + 1] as Shape, list[i] as Shape];
      }
    } else {
      for (let i = 1; i < list.length; i++) {
        if (chosen.has(list[i] as Shape) && !chosen.has(list[i - 1] as Shape)) [list[i], list[i - 1]] = [list[i - 1] as Shape, list[i] as Shape];
      }
    }
  }
}

/** Groupe des formes d'une meme liste. Renvoie l'identifiant du groupe, ou null si impossible (moins de 2 formes). */
export function groupShapes(shapes: Shape[], ids: readonly number[], name: string): number | null {
  const located = ids.map((id) => locate(shapes, id)).filter((f): f is Located => f !== null && f.shape.xfrm !== undefined);
  const list = located[0]?.list;
  const members = located.filter((f) => f.list === list);
  if (!list || members.length < 2) return null;
  const rects = members.map((f) => boundsOf(boxOfXfrm(f.shape.xfrm as Transform)));
  const b = unionRects(rects) as Rect;
  const at = Math.max(...members.map((f) => f.index));
  const children = list.filter((s) => members.some((m) => m.shape === s));
  const id = nextShapeId(shapes);
  const group: GroupShape = {
    kind: 'group',
    id,
    name: `${name} ${id - 1}`,
    xfrm: xfrmOfBox(b),
    childOffset: { x: b.x, y: b.y },
    childExtent: { width: b.width, height: b.height },
    children,
  };
  const remaining = list.filter((s) => !children.includes(s));
  const insertAt = at - (children.length - 1);
  remaining.splice(Math.max(0, insertAt), 0, group);
  list.splice(0, list.length, ...remaining);
  return id;
}

/** Dissocie un groupe : les enfants passent dans le repere du parent. Renvoie leurs identifiants. */
export function ungroup(shapes: Shape[], groupId: number): number[] {
  const found = locate(shapes, groupId);
  if (!found || found.shape.kind !== 'group') return [];
  const g = found.shape;
  const children = g.children.map((child) => {
    const copy = child;
    if (copy.xfrm) copy.xfrm = xfrmOfBox(childToParent(g, boxOfXfrm(copy.xfrm)));
    return copy;
  });
  found.list.splice(found.index, 1, ...children);
  return children.map((c) => c.id);
}

/** Retourne horizontalement ou verticalement (le texte n'est pas inverse, comme dans PowerPoint). */
export function flipShapes(shapes: Shape[], ids: readonly number[], axis: 'h' | 'v'): void {
  for (const id of ids) {
    const found = locate(shapes, id);
    if (!found?.shape.xfrm) continue;
    const x = { ...found.shape.xfrm };
    if (axis === 'h') x.flipH = !x.flipH || undefined;
    else x.flipV = !x.flipV || undefined;
    if (x.rotation) x.rotation = normalizeAngle(360 - x.rotation);
    if (!x.flipH) delete x.flipH;
    if (!x.flipV) delete x.flipV;
    if (!x.rotation) delete x.rotation;
    found.shape.xfrm = x;
  }
}

export function rotateShapes(shapes: Shape[], ids: readonly number[], deg: number): void {
  for (const id of ids) {
    const found = locate(shapes, id);
    if (!found?.shape.xfrm) continue;
    const rotation = normalizeAngle((found.shape.xfrm.rotation ?? 0) + deg);
    found.shape.xfrm = { ...found.shape.xfrm, rotation };
    if (!rotation) delete found.shape.xfrm.rotation;
  }
}

function pageRects(shapes: Shape[], ids: readonly number[]): Array<{ id: number; rect: Rect }> {
  const out: Array<{ id: number; rect: Rect }> = [];
  for (const id of ids) {
    const found = locate(shapes, id);
    const box = found && pageBox(found);
    if (box) out.push({ id, rect: boundsOf(box) });
  }
  return out;
}

/** Aligne la selection (sur la selection, ou sur la page si `page` est fourni ou s'il n'y a qu'une forme). */
export function alignShapes(shapes: Shape[], ids: readonly number[], mode: AlignMode, page?: { width: number; height: number }): void {
  const items = pageRects(shapes, ids);
  const reference = page || items.length < 2 ? { x: 0, y: 0, width: page?.width ?? 0, height: page?.height ?? 0 } : (unionRects(items.map((i) => i.rect)) as Rect);
  if (!page && items.length < 2) return;
  alignOffsets(items.map((i) => i.rect), mode, reference).forEach((d, i) => {
    const item = items[i];
    if (item) moveShapes(shapes, [item.id], d.x, d.y);
  });
}

export function distributeShapes(shapes: Shape[], ids: readonly number[], axis: 'h' | 'v', page?: { width: number; height: number }): void {
  const items = pageRects(shapes, ids);
  const span = page ? { x: 0, y: 0, width: page.width, height: page.height } : undefined;
  if (!span && items.length < 3) return;
  distributeOffsets(items.map((i) => i.rect), axis, span).forEach((d, i) => {
    const item = items[i];
    if (item) moveShapes(shapes, [item.id], d.x, d.y);
  });
}

/** Meme taille (largeur, hauteur ou les deux) que la premiere forme selectionnee. */
export function matchSize(shapes: Shape[], ids: readonly number[], which: 'width' | 'height' | 'both'): void {
  const first = ids[0] === undefined ? null : locate(shapes, ids[0]);
  const ref = first?.shape.xfrm;
  if (!ref) return;
  for (const id of ids.slice(1)) {
    const found = locate(shapes, id);
    if (!found?.shape.xfrm) continue;
    const x = { ...found.shape.xfrm };
    if (which !== 'height') x.width = ref.width;
    if (which !== 'width') x.height = ref.height;
    found.shape.xfrm = x;
  }
}
