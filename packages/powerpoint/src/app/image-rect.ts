// Rectangle de l'image exportee pour une selection : union des boites (tournees comprises) plus une marge.
import { boundsOf, type Box } from '../canvas/math.ts';

export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function imageRect(boxes: readonly Box[], pad: number): ImageRect | null {
  if (!boxes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const box of boxes) {
    const b = boundsOf(box);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  const width = x1 - x0 + 2 * pad;
  const height = y1 - y0 + 2 * pad;
  return width > 0 && height > 0 ? { x: x0 - pad, y: y0 - pad, width, height } : null;
}
