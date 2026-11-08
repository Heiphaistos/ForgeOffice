// Operations booleennes sur des polygones (union, intersection, soustraction, combinaison) par decoupe et classification des aretes.
// Les regions sont definies par la regle pair-impair : un ensemble de contours (exterieurs et trous).
// ponytail: O(n^2) en nombre d'aretes (formes de quelques centaines de segments) ; fragmenter (decoupe en faces) non couvert.

export interface Pt {
  x: number;
  y: number;
}
export type Ring = Pt[];
export type BoolOp = 'union' | 'intersect' | 'subtract' | 'combine';

const EPS = 1e-9;
const GRID = 1000;

/** Aire signee d'un contour (positive : sens trigonometrique dans un repere a y vers le haut). */
export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i] as Pt;
    const q = r[(i + 1) % r.length] as Pt;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

const key = (p: Pt): string => `${Math.round(p.x * GRID)}:${Math.round(p.y * GRID)}`;
const snap = (p: Pt): Pt => ({ x: Math.round(p.x * GRID) / GRID, y: Math.round(p.y * GRID) / GRID });

function inRing(p: Pt, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as Pt;
    const b = ring[j] as Pt;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Pair-impair : dans la region definie par l'ensemble de contours. */
export function inRegion(p: Pt, rings: readonly Ring[]): boolean {
  let n = 0;
  for (const r of rings) if (inRing(p, r)) n++;
  return n % 2 === 1;
}

interface Edge {
  a: Pt;
  b: Pt;
}

function ringEdges(rings: readonly Ring[]): Edge[] {
  const out: Edge[] = [];
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = snap(r[i] as Pt);
      const b = snap(r[(i + 1) % r.length] as Pt);
      if (key(a) !== key(b)) out.push({ a, b });
    }
  }
  return out;
}

/** Orientation : contours exterieurs en sens trigonometrique, trous en sens horaire (profondeur d'imbrication pair-impair). */
export function normalize(rings: readonly Ring[]): Ring[] {
  return rings
    .filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > EPS)
    .map((r) => {
      const probe = r[0] as Pt;
      const depth = rings.filter((o) => o !== r && inRing(probe, o)).length;
      const wantPositive = depth % 2 === 0;
      return ringArea(r) > 0 === wantPositive ? r : [...r].reverse();
    });
}

/** Parametres (0..1) auxquels `e` est coupee par les aretes de `others`. */
function splitParams(e: Edge, others: readonly Edge[]): number[] {
  const rx = e.b.x - e.a.x;
  const ry = e.b.y - e.a.y;
  const len2 = rx * rx + ry * ry;
  const ts = new Set<number>([0, 1]);
  for (const o of others) {
    const sx = o.b.x - o.a.x;
    const sy = o.b.y - o.a.y;
    const denom = rx * sy - ry * sx;
    const qpx = o.a.x - e.a.x;
    const qpy = o.a.y - e.a.y;
    if (Math.abs(denom) < EPS * Math.sqrt(len2 * (sx * sx + sy * sy))) {
      if (Math.abs(qpx * ry - qpy * rx) < 1e-6 * Math.sqrt(len2)) {
        for (const p of [o.a, o.b]) {
          const t = ((p.x - e.a.x) * rx + (p.y - e.a.y) * ry) / len2;
          if (t > 0 && t < 1) ts.add(t);
        }
      }
      continue;
    }
    const t = (qpx * sy - qpy * sx) / denom;
    const u = (qpx * ry - qpy * rx) / denom;
    if (t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9) ts.add(Math.min(1, Math.max(0, t)));
  }
  return [...ts].sort((x, y) => x - y);
}

function split(edges: readonly Edge[], others: readonly Edge[]): Edge[] {
  const out: Edge[] = [];
  for (const e of edges) {
    const ts = splitParams(e, others);
    let prev = e.a;
    for (let i = 1; i < ts.length; i++) {
      const p = i === ts.length - 1 ? e.b : snap({ x: e.a.x + (e.b.x - e.a.x) * (ts[i] as number), y: e.a.y + (e.b.y - e.a.y) * (ts[i] as number) });
      if (key(p) !== key(prev)) out.push({ a: prev, b: p });
      prev = p;
    }
  }
  return out;
}

type Status = 'in' | 'out' | 'same' | 'opposite';

function classify(edges: readonly Edge[], otherEdges: readonly Edge[], otherRings: readonly Ring[]): Array<{ edge: Edge; status: Status }> {
  const directed = new Set(otherEdges.map((e) => `${key(e.a)}>${key(e.b)}`));
  return edges.map((edge) => {
    if (directed.has(`${key(edge.a)}>${key(edge.b)}`)) return { edge, status: 'same' as const };
    if (directed.has(`${key(edge.b)}>${key(edge.a)}`)) return { edge, status: 'opposite' as const };
    const mid = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };
    return { edge, status: inRegion(mid, otherRings) ? ('in' as const) : ('out' as const) };
  });
}

const reversed = (e: Edge): Edge => ({ a: e.b, b: e.a });

/** Chaine des aretes orientees en contours fermes. */
function chain(edges: readonly Edge[]): Ring[] {
  const from = new Map<string, Edge[]>();
  for (const e of edges) {
    const list = from.get(key(e.a)) ?? [];
    list.push(e);
    from.set(key(e.a), list);
  }
  const rings: Ring[] = [];
  for (const start of edges) {
    if (!(from.get(key(start.a)) ?? []).includes(start)) continue;
    const ring: Ring = [];
    let cur: Edge | undefined = start;
    while (cur) {
      const list = from.get(key(cur.a)) as Edge[];
      list.splice(list.indexOf(cur), 1);
      ring.push(cur.a);
      const next: Edge | undefined = (from.get(key(cur.b)) ?? [])[0];
      if (key(cur.b) === key(start.a)) break;
      cur = next;
    }
    if (ring.length >= 3 && Math.abs(ringArea(ring)) > 1e-6) rings.push(dropCollinear(ring));
  }
  return rings;
}

function dropCollinear(r: Ring): Ring {
  const out: Ring = [];
  for (let i = 0; i < r.length; i++) {
    const p = r[(i + r.length - 1) % r.length] as Pt;
    const c = r[i] as Pt;
    const n = r[(i + 1) % r.length] as Pt;
    if (Math.abs((c.x - p.x) * (n.y - c.y) - (c.y - p.y) * (n.x - c.x)) > 1e-9) out.push(c);
  }
  return out.length >= 3 ? out : r;
}

function single(a: Ring[], b: Ring[], op: Exclude<BoolOp, 'combine'>): Ring[] {
  const A = normalize(a);
  const B = normalize(b);
  const ea = ringEdges(A);
  const eb = ringEdges(B);
  const sa = split(ea, eb);
  const sb = split(eb, ea);
  const ca = classify(sa, sb, B);
  const cb = classify(sb, sa, A);
  const kept: Edge[] = [];
  for (const { edge, status } of ca) {
    if (op === 'union' && (status === 'out' || status === 'same')) kept.push(edge);
    else if (op === 'intersect' && (status === 'in' || status === 'same')) kept.push(edge);
    else if (op === 'subtract' && (status === 'out' || status === 'opposite')) kept.push(edge);
  }
  for (const { edge, status } of cb) {
    if (op === 'union' && status === 'out') kept.push(edge);
    else if (op === 'intersect' && status === 'in') kept.push(edge);
    else if (op === 'subtract' && status === 'in') kept.push(reversed(edge));
  }
  return normalize(chain(kept));
}

/** Operation booleenne sur deux ensembles de contours ; `combine` = ou exclusif (le recouvrement disparait). */
export function booleanOp(a: Ring[], b: Ring[], op: BoolOp): Ring[] {
  if (op === 'combine') return [...single(a, b, 'subtract'), ...single(b, a, 'subtract')];
  return single(a, b, op);
}

/** Aire de la region (pair-impair) d'un ensemble de contours normalises. */
export function regionArea(rings: readonly Ring[]): number {
  return normalize(rings).reduce((sum, r) => sum + ringArea(r), 0);
}
