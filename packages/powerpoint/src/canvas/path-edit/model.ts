// Modele editable d'un contour : noeuds avec poignees de Bezier, conversions depuis / vers la geometrie DrawingML.
import { ptToEmu, type Geometry, type GeometryPath, type PathCommand } from '@forgeoffice/pptx';
import type { Pt, Ring } from '../boolean-ops/clip.ts';

/** Noeud d'un contour ; `inH` et `outH` sont les poignees (positions absolues), absentes pour un angle vif. */
export interface PathNode extends Pt {
  inH?: Pt;
  outH?: Pt;
}

export interface SubPath {
  nodes: PathNode[];
  closed: boolean;
}

const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/** Analyse un `d` SVG absolu (M, L, C, Q, Z) en contours a noeuds ; Q devient une cubique. */
export function parseSvgPath(d: string): SubPath[] {
  const out: SubPath[] = [];
  let cur: SubPath | null = null;
  for (const m of d.matchAll(/([MLCQZ])([^MLCQZ]*)/g)) {
    const letter = m[1] as string;
    const n = (m[2] ?? '').match(NUM)?.map(Number) ?? [];
    const last = cur?.nodes[cur.nodes.length - 1];
    if (letter === 'M') {
      cur = { nodes: [{ x: n[0] ?? 0, y: n[1] ?? 0 }], closed: false };
      out.push(cur);
    } else if (!cur || !last) {
      continue;
    } else if (letter === 'L') {
      cur.nodes.push({ x: n[0] ?? 0, y: n[1] ?? 0 });
    } else if (letter === 'C') {
      last.outH = { x: n[0] ?? 0, y: n[1] ?? 0 };
      cur.nodes.push({ x: n[4] ?? 0, y: n[5] ?? 0, inH: { x: n[2] ?? 0, y: n[3] ?? 0 } });
    } else if (letter === 'Q') {
      const [qx, qy, x, y] = [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 0];
      last.outH = { x: last.x + (2 / 3) * (qx - last.x), y: last.y + (2 / 3) * (qy - last.y) };
      cur.nodes.push({ x, y, inH: { x: x + (2 / 3) * (qx - x), y: y + (2 / 3) * (qy - y) } });
    } else {
      cur.closed = true;
      const first = cur.nodes[0] as PathNode;
      const end = cur.nodes[cur.nodes.length - 1] as PathNode;
      // Un dernier point confondu avec le premier est le meme noeud : ses poignees d'entree passent au premier.
      if (cur.nodes.length > 1 && Math.abs(end.x - first.x) < 1e-6 && Math.abs(end.y - first.y) < 1e-6) {
        if (end.inH) first.inH = end.inH;
        cur.nodes.pop();
      }
    }
  }
  return out;
}

const cubicAt = (a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
};

/** Polyligne d'un contour : les courbes sont echantillonnees selon la longueur de leur polygone de controle (`tol` en points). */
export function flatten(sub: SubPath, tol = 0.15): Ring {
  const pts: Ring = [];
  const count = sub.closed ? sub.nodes.length : sub.nodes.length - 1;
  for (let i = 0; i < count; i++) {
    const a = sub.nodes[i] as PathNode;
    const b = sub.nodes[(i + 1) % sub.nodes.length] as PathNode;
    pts.push({ x: a.x, y: a.y });
    if (!a.outH && !b.inH) continue;
    const c1 = a.outH ?? a;
    const c2 = b.inH ?? b;
    const ctrl = Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(b.x - c2.x, b.y - c2.y);
    const steps = Math.max(4, Math.min(64, Math.ceil(Math.sqrt(ctrl / tol))));
    for (let s = 1; s < steps; s++) pts.push(cubicAt(a, c1, c2, b, s / steps));
  }
  if (!sub.closed && sub.nodes.length) pts.push({ ...(sub.nodes[sub.nodes.length - 1] as PathNode) });
  return pts;
}

const emuPt = (p: Pt) => ({ x: ptToEmu(p.x), y: ptToEmu(p.y) });

/** Commandes DrawingML (EMU) d'un contour, relatives a l'origine (`ox`, `oy`) en points. */
export function toCommands(sub: SubPath, ox: number, oy: number): PathCommand[] {
  const rel = (p: Pt): Pt => ({ x: p.x - ox, y: p.y - oy });
  const out: PathCommand[] = [];
  const first = sub.nodes[0];
  if (!first) return out;
  out.push({ cmd: 'moveTo', pt: emuPt(rel(first)) });
  const count = sub.closed ? sub.nodes.length : sub.nodes.length - 1;
  for (let i = 0; i < count; i++) {
    const a = sub.nodes[i] as PathNode;
    const b = sub.nodes[(i + 1) % sub.nodes.length] as PathNode;
    if (a.outH || b.inH) out.push({ cmd: 'cubicBezTo', pts: [emuPt(rel(a.outH ?? a)), emuPt(rel(b.inH ?? b)), emuPt(rel(b))] });
    else out.push({ cmd: 'lineTo', pt: emuPt(rel(b)) });
  }
  if (sub.closed) out.push({ cmd: 'close' });
  return out;
}

/** Geometrie personnalisee d'un ensemble de contours dans un cadre de `width` x `height` points d'origine (`ox`, `oy`). */
export function toGeometry(subs: readonly SubPath[], ox: number, oy: number, width: number, height: number, filled: boolean): Geometry {
  const path: GeometryPath = { width: ptToEmu(width), height: ptToEmu(height), fill: filled ? 'norm' : 'none', commands: subs.flatMap((s) => toCommands(s, ox, oy)) };
  return { type: 'custom', paths: [path] };
}

/** Contour a noeuds d'un polygone. */
export const polygonToSubPath = (ring: Ring): SubPath => ({ nodes: ring.map((p) => ({ x: p.x, y: p.y })), closed: true });

/** Rectangle englobant des contours (courbes echantillonnees). */
export function nodeBounds(subs: readonly SubPath[]): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of subs) {
    for (const p of flatten(s, 0.5)) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  }
  return x0 === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
