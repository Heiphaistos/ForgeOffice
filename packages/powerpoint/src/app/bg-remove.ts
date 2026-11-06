// Suppression de l'arriere-plan d'une image (sans DOM) : couleur de fond echantillonnee sur les bords,
// zone de meme couleur connectee aux bords (tolerance), masque alpha avec bord adouci.

/** Image RGBA (comme ImageData). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type Rgb = readonly [number, number, number];

/** Distance maximale entre deux couleurs RVB (noir et blanc). */
const MAX_DISTANCE = Math.sqrt(3 * 255 * 255);

/** Ecart de couleur en % (0 = identique, 100 = noir contre blanc). */
export function colorDistance(a: Rgb, b: Rgb): number {
  return (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / MAX_DISTANCE) * 100;
}

function pixel(img: RgbaImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 4;
  return [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
}

/** Couleur de fond : la plus frequente parmi les pixels du bord (quantifiee par pas de 16 niveaux), puis moyenne de ce groupe. */
export function sampleBackground(img: RgbaImage): Rgb {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number): void => {
    const i = (y * img.width + x) * 4;
    if ((img.data[i + 3] ?? 255) < 16) return; // deja transparent
    const [r, g, b] = pixel(img, x, y);
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  };
  for (let x = 0; x < img.width; x++) {
    add(x, 0);
    add(x, img.height - 1);
  }
  for (let y = 1; y < img.height - 1; y++) {
    add(0, y);
    add(img.width - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  return best ? [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)] : [255, 255, 255];
}

/**
 * Masque d'arriere-plan : 1 = a supprimer. Pixels de couleur proche de `color` (ecart <= `tolerance` %).
 * `contiguous` : seule la zone reliee aux bords de l'image est retiree (les parties interieures de meme couleur restent).
 */
export function backgroundMask(img: RgbaImage, color: Rgb, tolerance: number, contiguous = true): Uint8Array {
  const { width: w, height: h } = img;
  const mask = new Uint8Array(w * h);
  const close = (x: number, y: number): boolean => colorDistance(pixel(img, x, y), color) <= tolerance;
  if (!contiguous) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (close(x, y)) mask[y * w + x] = 1;
    return mask;
  }
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    const k = y * w + x;
    if (mask[k] || !close(x, y)) return;
    mask[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const k = stack.pop() as number;
    const x = k % w;
    const y = (k - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return mask;
}

/** Image dont les pixels masques sont transparents ; le pixel conserve touchant le fond est adouci (demi-transparent). */
export function applyMask(img: RgbaImage, mask: Uint8Array, soften = true): RgbaImage {
  const { width: w, height: h } = img;
  const data = new Uint8ClampedArray(img.data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (mask[k]) {
        data[k * 4 + 3] = 0;
        continue;
      }
      if (!soften) continue;
      const touches = (x > 0 && mask[k - 1]) || (x < w - 1 && mask[k + 1]) || (y > 0 && mask[k - w]) || (y < h - 1 && mask[k + w]);
      if (touches) data[k * 4 + 3] = Math.round((data[k * 4 + 3] ?? 255) * 0.6);
    }
  }
  return { width: w, height: h, data };
}

/** Part de l'image retiree (0..1), pour l'aperçu. */
export function removedShare(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) n += v;
  return mask.length ? n / mask.length : 0;
}
