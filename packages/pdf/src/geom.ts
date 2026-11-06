// Geometrie d'une page PDF : boite visible (CropBox bornee par la MediaBox, comme pdf.js) et /Rotate.
import type { PDFPage } from '@cantoo/pdf-lib';
import type { PageGeom } from './model.ts';

export function geomOf(page: PDFPage): PageGeom {
  const c = page.getCropBox();
  const m = page.getMediaBox();
  const x0 = Math.max(c.x, m.x);
  const y0 = Math.max(c.y, m.y);
  const x1 = Math.min(c.x + c.width, m.x + m.width);
  const y1 = Math.min(c.y + c.height, m.y + m.height);
  const ok = x1 > x0 && y1 > y0;
  return { box: ok ? [x0, y0, x1, y1] : [m.x, m.y, m.x + m.width, m.y + m.height], rotate: ((page.getRotation().angle % 360) + 360) % 360 };
}
