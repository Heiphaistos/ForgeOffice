// Geometries libres OpenDocument -> geometrie personnalisee : chemins « draw:enhanced-geometry » (draw:enhanced-path),
// « draw:path » (syntaxe SVG), « draw:polygon » / « draw:polyline » (draw:points). Les chemins qui reposent sur des
// formules (?f0, $0) ne sont pas convertis (la forme reste un rectangle).
import { attr, type XmlElement } from '@forgeoffice/opc';
import type { Geometry, PathCommand, PathPoint } from './dml.ts';

const MAX_COMMANDS = 20_000;
const NUMBER = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i;
const TOKENS = /[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function viewBoxOf(raw: string | undefined): { width: number; height: number } | undefined {
  const parts = (raw ?? '').trim().split(/[\s,]+/).map(Number);
  const [, , width, height] = parts;
  return parts.length === 4 && parts.every(Number.isFinite) && width && height && width > 0 && height > 0 ? { width, height } : undefined;
}

const geometry = (commands: PathCommand[], box: { width: number; height: number }, noFill = false): Geometry | undefined =>
  commands.length > 1 ? { type: 'custom', paths: [{ width: box.width, height: box.height, ...(noFill ? { fill: 'none' as const } : {}), commands }] } : undefined;

const pt = (x: number, y: number): PathPoint => ({ x, y });

/** Chemin d'une geometrie ODF avancee : M L C Q Z N (F = sans remplissage, S = sans contour). */
export function enhancedGeometryPath(node: XmlElement | undefined): Geometry | undefined {
  const box = viewBoxOf(attr(node, 'svg:viewBox'));
  const d = attr(node, 'draw:enhanced-path');
  if (!box || !d || /[?$]/.test(d)) return undefined;
  const tokens = d.match(TOKENS) ?? [];
  const out: PathCommand[] = [];
  let command = '';
  let noFill = false;
  for (let i = 0; i < tokens.length && out.length < MAX_COMMANDS;) {
    const token = tokens[i] as string;
    if (!NUMBER.test(token)) {
      command = token.toUpperCase();
      i++;
      if (command === 'Z') out.push({ cmd: 'close' });
      else if (command === 'F') noFill = true;
      else if (!'MLCQNS'.includes(command)) return undefined;
      continue;
    }
    const need = command === 'C' ? 6 : command === 'Q' ? 4 : command === 'M' || command === 'L' ? 2 : 0;
    const n = tokens.slice(i, i + need).map(Number);
    if (!need || n.length < need || n.some((v) => !Number.isFinite(v))) return undefined;
    i += need;
    const [a, b, c, e, f, g] = n as [number, number, number, number, number, number];
    if (command === 'M') {
      out.push({ cmd: 'moveTo', pt: pt(a, b) });
      command = 'L';
    } else if (command === 'L') {
      out.push({ cmd: 'lineTo', pt: pt(a, b) });
    } else if (command === 'C') {
      out.push({ cmd: 'cubicBezTo', pts: [pt(a, b), pt(c, e), pt(f, g)] });
    } else {
      out.push({ cmd: 'quadBezTo', pts: [pt(a, b), pt(c, e)] });
    }
  }
  return geometry(out, box, noFill);
}

/** Syntaxe SVG (draw:path / svg:d) : M L H V C Q Z, absolus et relatifs. */
export function svgPathGeometry(d: string | undefined, viewBox: string | undefined): Geometry | undefined {
  const box = viewBoxOf(viewBox);
  if (!d || !box) return undefined;
  const tokens = d.match(TOKENS) ?? [];
  const out: PathCommand[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let command = '';
  for (let i = 0; i < tokens.length && out.length < MAX_COMMANDS;) {
    const token = tokens[i] as string;
    if (!NUMBER.test(token)) {
      command = token;
      i++;
      if (command === 'Z' || command === 'z') {
        out.push({ cmd: 'close' });
        [cx, cy] = [sx, sy];
      } else if (!'MmLlHhVvCcQq'.includes(command)) return undefined;
      continue;
    }
    const upper = command.toUpperCase();
    const rel = command !== upper;
    const need = upper === 'C' ? 6 : upper === 'Q' ? 4 : upper === 'H' || upper === 'V' ? 1 : 2;
    const n = tokens.slice(i, i + need).map(Number);
    if (n.length < need || n.some((v) => !Number.isFinite(v))) return undefined;
    i += need;
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    const [a, b, c, e, f, g] = n as [number, number, number, number, number, number];
    if (upper === 'H') {
      cx = a + ox;
      out.push({ cmd: 'lineTo', pt: pt(cx, cy) });
    } else if (upper === 'V') {
      cy = a + oy;
      out.push({ cmd: 'lineTo', pt: pt(cx, cy) });
    } else if (upper === 'C') {
      out.push({ cmd: 'cubicBezTo', pts: [pt(a + ox, b + oy), pt(c + ox, e + oy), pt(f + ox, g + oy)] });
      [cx, cy] = [f + ox, g + oy];
    } else if (upper === 'Q') {
      out.push({ cmd: 'quadBezTo', pts: [pt(a + ox, b + oy), pt(c + ox, e + oy)] });
      [cx, cy] = [c + ox, e + oy];
    } else {
      [cx, cy] = [a + ox, b + oy];
      if (upper === 'M') {
        [sx, sy] = [cx, cy];
        out.push({ cmd: 'moveTo', pt: pt(cx, cy) });
        command = rel ? 'l' : 'L';
      } else {
        out.push({ cmd: 'lineTo', pt: pt(cx, cy) });
      }
    }
  }
  return geometry(out, box);
}

/** draw:polygon (ferme) et draw:polyline : liste « x,y x,y ». */
export function pointsGeometry(points: string | undefined, viewBox: string | undefined, closed: boolean): Geometry | undefined {
  const box = viewBoxOf(viewBox);
  const nums = (points ?? '').trim().split(/[\s,]+/).map(Number);
  if (!box || nums.length < 4 || nums.length % 2 || nums.some((n) => !Number.isFinite(n))) return undefined;
  const out: PathCommand[] = [];
  for (let i = 0; i + 1 < nums.length && out.length < MAX_COMMANDS; i += 2) out.push({ cmd: i === 0 ? 'moveTo' : 'lineTo', pt: pt(nums[i] as number, nums[i + 1] as number) });
  if (closed) out.push({ cmd: 'close' });
  return geometry(out, box, !closed);
}
