// Signature à partir d'une image importée (photo ou scan) : cadrage dans le pavé et fond blanc rendu transparent (sans DOM, testé).

/** Position et taille d'une image de `w` x `h` contenue dans `cw` x `ch` avec une marge, centrée, jamais agrandie au-delà de 2x. */
export function fitContain(w: number, h: number, cw: number, ch: number, margin = 10): { x: number; y: number; w: number; h: number } {
  const scale = Math.min((cw - 2 * margin) / w, (ch - 2 * margin) / h, 2);
  const [dw, dh] = [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
  return { x: Math.round((cw - dw) / 2), y: Math.round((ch - dh) / 2), w: dw, h: dh };
}

/** Rend transparents les pixels clairs (papier blanc) ; l'opacité décroît en douceur vers le seuil pour garder des bords nets. Renvoie le nombre de pixels encre. */
export function whiteToTransparent(rgba: Uint8ClampedArray, threshold = 235): number {
  let ink = 0;
  const soft = 40;
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = 0.299 * (rgba[i] ?? 0) + 0.587 * (rgba[i + 1] ?? 0) + 0.114 * (rgba[i + 2] ?? 0);
    const keep = lum >= threshold ? 0 : lum <= threshold - soft ? 1 : (threshold - lum) / soft;
    rgba[i + 3] = Math.round((rgba[i + 3] ?? 255) * keep);
    if (keep > 0.5) ink++;
  }
  return ink;
}
