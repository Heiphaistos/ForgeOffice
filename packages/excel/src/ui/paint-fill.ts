// Dessin des remplissages a motif et en degrade (canvas) : cellules de la grille et apercus de la boite Format de cellule.
import { patternPixel, type PaintFill } from '../logic/fill-spec.ts';

const tiles = new Map<string, CanvasPattern>();

function tile(ctx: CanvasRenderingContext2D, f: Extract<PaintFill, { kind: 'pattern' }>): CanvasPattern | null {
  const key = `${f.pattern}|${f.fg}|${f.bg}`;
  const hit = tiles.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const t = c.getContext('2d');
  if (!t) return null;
  t.fillStyle = f.bg;
  t.fillRect(0, 0, 8, 8);
  t.fillStyle = f.fg;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (patternPixel(f.pattern, x, y)) t.fillRect(x, y, 1, 1);
  const p = ctx.createPattern(c, 'repeat');
  if (!p) return null;
  if (tiles.size > 200) tiles.clear();
  tiles.set(key, p);
  return p;
}

/** Remplit le rectangle ; le motif est ancre en haut a gauche du rectangle (chaque cellule a le meme dessin). */
export function paintFill(ctx: CanvasRenderingContext2D, f: PaintFill, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (f.kind === 'pattern') {
    const p = tile(ctx, f);
    ctx.translate(x, y);
    ctx.fillStyle = p ?? f.bg;
    ctx.fillRect(0, 0, w, h);
  } else {
    let g: CanvasGradient;
    if (f.path) {
      const cx = x + w * f.focus.x;
      const cy = y + h * f.focus.y;
      const r = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    } else {
      const a = (f.degree * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    }
    for (const s of f.stops) g.addColorStop(Math.max(0, Math.min(1, s.position)), s.color);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
