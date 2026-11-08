// Operations d'edition de points sur des contours (immuables : chaque fonction renvoie de nouveaux contours).
import type { Pt } from '../boolean-ops/clip.ts';
import { flatten, type PathNode, type SubPath } from './model.ts';

export type NodeKind = 'corner' | 'smooth' | 'symmetric';
export type HandleSide = 'inH' | 'outH';

const clone = (subs: readonly SubPath[]): SubPath[] => subs.map((s) => ({ closed: s.closed, nodes: s.nodes.map((n) => ({ ...n, inH: n.inH && { ...n.inH }, outH: n.outH && { ...n.outH } })) }));
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Type d'un noeud d'apres ses poignees : lisse = poignees alignees, symetrique = alignees et de meme longueur. */
export function nodeKind(n: PathNode): NodeKind {
  if (!n.inH || !n.outH) return 'corner';
  const ax = n.inH.x - n.x;
  const ay = n.inH.y - n.y;
  const bx = n.outH.x - n.x;
  const by = n.outH.y - n.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return 'corner';
  const collinear = Math.abs(ax * by - ay * bx) / (la * lb) < 1e-3 && ax * bx + ay * by < 0;
  if (!collinear) return 'corner';
  return Math.abs(la - lb) / Math.max(la, lb) < 1e-3 ? 'symmetric' : 'smooth';
}

export function moveNode(subs: readonly SubPath[], si: number, ni: number, dx: number, dy: number): SubPath[] {
  const out = clone(subs);
  const n = out[si]?.nodes[ni];
  if (!n) return out;
  n.x += dx;
  n.y += dy;
  if (n.inH) n.inH = { x: n.inH.x + dx, y: n.inH.y + dy };
  if (n.outH) n.outH = { x: n.outH.x + dx, y: n.outH.y + dy };
  return out;
}

/**
 * Deplace une poignee. `kind` (type du noeud avant le geste) conserve l'alignement de l'autre poignee :
 * lisse = meme direction (longueur propre), symetrique = meme longueur.
 */
export function moveHandle(subs: readonly SubPath[], si: number, ni: number, side: HandleSide, to: Pt, kind: NodeKind): SubPath[] {
  const out = clone(subs);
  const n = out[si]?.nodes[ni];
  if (!n) return out;
  n[side] = { ...to };
  const other: HandleSide = side === 'inH' ? 'outH' : 'inH';
  const o = n[other];
  if (kind !== 'corner' && o) {
    const vx = n.x - to.x;
    const vy = n.y - to.y;
    const len = Math.hypot(vx, vy);
    if (len > 1e-9) {
      const keep = kind === 'symmetric' ? len : dist(o, n);
      n[other] = { x: n.x + (vx / len) * keep, y: n.y + (vy / len) * keep };
    }
  }
  return out;
}

/** Index du noeud d'arrivee d'un segment i (le contour ferme boucle). */
const nextIndex = (s: SubPath, i: number): number => (i + 1) % s.nodes.length;

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Insere un noeud sur le segment `seg` du contour (de Casteljau : la courbe garde exactement sa forme). */
export function insertNode(subs: readonly SubPath[], si: number, seg: number, t: number): SubPath[] {
  const out = clone(subs);
  const s = out[si];
  if (!s) return out;
  const a = s.nodes[seg] as PathNode;
  const b = s.nodes[nextIndex(s, seg)] as PathNode;
  let node: PathNode;
  if (a.outH || b.inH) {
    const c1 = a.outH ?? a;
    const c2 = b.inH ?? b;
    const p01 = lerp(a, c1, t);
    const p12 = lerp(c1, c2, t);
    const p23 = lerp(c2, b, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const mid = lerp(p012, p123, t);
    a.outH = p01;
    b.inH = p23;
    node = { x: mid.x, y: mid.y, inH: p012, outH: p123 };
  } else {
    const p = lerp(a, b, t);
    node = { x: p.x, y: p.y };
  }
  s.nodes.splice(seg + 1, 0, node);
  return out;
}

/** Supprime un noeud ; la courbe voisine garde ses poignees exterieures. Un contour reduit a un noeud disparait. */
export function deleteNode(subs: readonly SubPath[], si: number, ni: number): SubPath[] {
  const out = clone(subs);
  const s = out[si];
  if (!s) return out;
  s.nodes.splice(ni, 1);
  return out.filter((sub) => sub.nodes.length >= 2);
}

export function setNodeKind(subs: readonly SubPath[], si: number, ni: number, kind: NodeKind): SubPath[] {
  const out = clone(subs);
  const s = out[si];
  const n = s?.nodes[ni];
  if (!s || !n) return out;
  if (kind === 'corner') {
    delete n.inH;
    delete n.outH;
    return out;
  }
  const prev = s.nodes[(ni + s.nodes.length - 1) % s.nodes.length] as PathNode;
  const next = s.nodes[nextIndex(s, ni)] as PathNode;
  // Direction de la tangente : parallele a la corde voisin precedent -> suivant ; longueur : un tiers du plus proche voisin.
  const tx = next.x - prev.x;
  const ty = next.y - prev.y;
  const tl = Math.hypot(tx, ty) || 1;
  const lenIn = (n.inH ? dist(n.inH, n) : dist(prev, n) / 3) || 1;
  const lenOut = (n.outH ? dist(n.outH, n) : dist(next, n) / 3) || 1;
  const len = kind === 'symmetric' ? Math.min(lenIn, lenOut) : undefined;
  n.inH = { x: n.x - (tx / tl) * (len ?? lenIn), y: n.y - (ty / tl) * (len ?? lenIn) };
  n.outH = { x: n.x + (tx / tl) * (len ?? lenOut), y: n.y + (ty / tl) * (len ?? lenOut) };
  return out;
}

/** Segment droit (poignees du segment retirees) ou courbe (poignees au tiers). */
export function setSegmentKind(subs: readonly SubPath[], si: number, seg: number, kind: 'line' | 'curve'): SubPath[] {
  const out = clone(subs);
  const s = out[si];
  if (!s) return out;
  const a = s.nodes[seg] as PathNode;
  const b = s.nodes[nextIndex(s, seg)] as PathNode;
  if (kind === 'line') {
    delete a.outH;
    delete b.inH;
  } else {
    a.outH = lerp(a, b, 1 / 3);
    b.inH = lerp(a, b, 2 / 3);
  }
  return out;
}

export function setClosed(subs: readonly SubPath[], si: number, closed: boolean): SubPath[] {
  const out = clone(subs);
  const s = out[si];
  if (s && s.nodes.length >= 3) s.closed = closed;
  return out;
}

export interface Nearest {
  si: number;
  seg: number;
  t: number;
  distance: number;
}

/** Point du contour le plus proche de `p` (segment, abscisse 0..1 sur ce segment, distance). */
export function nearestOnPath(subs: readonly SubPath[], p: Pt): Nearest | null {
  let best: Nearest | null = null;
  subs.forEach((s, si) => {
    const count = s.closed ? s.nodes.length : s.nodes.length - 1;
    for (let seg = 0; seg < count; seg++) {
      const piece: SubPath = { closed: false, nodes: [s.nodes[seg] as PathNode, s.nodes[nextIndex(s, seg)] as PathNode] };
      const pts = flatten(piece, 0.5);
      let total = 0;
      const lens = pts.slice(1).map((q, i) => (total += dist(q, pts[i] as Pt), total));
      let walked = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const q = pts[i] as Pt;
        const r = pts[i + 1] as Pt;
        const vx = r.x - q.x;
        const vy = r.y - q.y;
        const l2 = vx * vx + vy * vy || 1;
        const u = Math.max(0, Math.min(1, ((p.x - q.x) * vx + (p.y - q.y) * vy) / l2));
        const d = dist(p, { x: q.x + vx * u, y: q.y + vy * u });
        if (!best || d < best.distance) best = { si, seg, t: (walked + u * dist(q, r)) / (total || 1), distance: d };
        walked = lens[i] as number;
      }
    }
  });
  return best;
}
