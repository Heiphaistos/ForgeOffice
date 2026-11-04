// Conversion des commandes de chemin DrawingML en donnees de chemin SVG (`d`).
import type { GeometryPath, PathPoint } from '@forgeoffice/pptx';
import { valueOf, type Vars } from './formula.ts';

const ANGLE_TO_RAD = Math.PI / (180 * 60000);
const QUARTER = Math.PI / 2;
const TURN = Math.PI * 2;

/** Nombre court et toujours fini pour `d`. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Angle parametrique d'un point d'ellipse a l'angle visuel `theta` (radians) : OOXML exprime
 * stAng/swAng en angles visuels. Le resultat reste dans le meme tour que `theta`.
 */
function paramAngle(theta: number, wR: number, hR: number): number {
  const base = Math.atan2(wR * Math.sin(theta), hR * Math.cos(theta));
  return base + TURN * Math.round((theta - base) / TURN);
}

/**
 * Chemin SVG d'un chemin DrawingML. (sx, sy) convertissent le repere du chemin en points locaux.
 * Les arcs (arcTo, relatifs au point courant) deviennent des courbes de Bezier cubiques d'au plus 90 degres.
 */
export function pathToSvg(path: GeometryPath, vars: Vars, sx: number, sy: number): string {
  const out: string[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const pt = (p: PathPoint): [number, number] => [valueOf(p.x, vars), valueOf(p.y, vars)];
  const emit = (letter: string, ...coords: number[]): void => {
    const parts = [letter];
    for (let i = 0; i < coords.length; i += 2) parts.push(fmt((coords[i] ?? 0) * sx), fmt((coords[i + 1] ?? 0) * sy));
    out.push(parts.join(' '));
  };
  for (const c of path.commands) {
    switch (c.cmd) {
      case 'moveTo': {
        [cx, cy] = pt(c.pt);
        [startX, startY] = [cx, cy];
        emit('M', cx, cy);
        break;
      }
      case 'lineTo':
        [cx, cy] = pt(c.pt);
        emit('L', cx, cy);
        break;
      case 'cubicBezTo': {
        const coords = c.pts.flatMap(pt);
        emit('C', ...coords);
        [cx, cy] = [coords[4] ?? 0, coords[5] ?? 0];
        break;
      }
      case 'quadBezTo': {
        const coords = c.pts.flatMap(pt);
        emit('Q', ...coords);
        [cx, cy] = [coords[2] ?? 0, coords[3] ?? 0];
        break;
      }
      case 'arcTo': {
        const wR = valueOf(c.wR, vars);
        const hR = valueOf(c.hR, vars);
        const st = valueOf(c.stAng, vars) * ANGLE_TO_RAD;
        const sw = valueOf(c.swAng, vars) * ANGLE_TO_RAD;
        const t1 = paramAngle(st, wR, hR);
        let sweep = paramAngle(st + sw, wR, hR) - t1;
        // Plus d'un tour : le trace ne change pas au-dela d'un tour complet (borne le nombre de segments).
        if (Math.abs(sweep) > TURN) sweep = Math.sign(sweep) * (TURN + (Math.abs(sweep) % TURN));
        const ox = cx - wR * Math.cos(t1);
        const oy = cy - hR * Math.sin(t1);
        const n = Math.ceil(Math.abs(sweep) / QUARTER - 1e-9);
        const step = n > 0 ? sweep / n : 0;
        const k = (4 / 3) * Math.tan(step / 4);
        for (let i = 0; i < n; i++) {
          const a = t1 + step * i;
          const b = a + step;
          const ax = ox + wR * Math.cos(a);
          const ay = oy + hR * Math.sin(a);
          const bx = ox + wR * Math.cos(b);
          const by = oy + hR * Math.sin(b);
          emit('C', ax - k * wR * Math.sin(a), ay + k * hR * Math.cos(a), bx + k * wR * Math.sin(b), by - k * hR * Math.cos(b), bx, by);
          [cx, cy] = [bx, by];
        }
        break;
      }
      case 'close':
        out.push('Z');
        [cx, cy] = [startX, startY];
        break;
    }
  }
  return out.join(' ');
}
