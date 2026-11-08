// Conversion RVB -> CMJN pour l'export PDF « CMJN » (option : le RVB reste le defaut).
// Conversion simple a noir generique (pas de profil ICC) : adaptee a un test d'epreuve, pas a une calibration d'imprimeur.

/** Convertit des pixels RGBA (canvas) en octets CMJN (4 par pixel, 0 = pas d'encre, 255 = encre pleine) ; `spots` : aplats de tons directs. */
export function rgbaToCmyk(rgba: Uint8ClampedArray | Uint8Array, spots?: ReadonlyMap<number, readonly [number, number, number, number]>): Uint8Array {
  const n = Math.floor(rgba.length / 4);
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    if (spots && rgba[i * 4 + 3] === 255) {
      const spot = spots.get(((rgba[i * 4] as number) << 16) | ((rgba[i * 4 + 1] as number) << 8) | (rgba[i * 4 + 2] as number));
      if (spot) {
        out.set(spot, i * 4);
        continue;
      }
    }
    const a = (rgba[i * 4 + 3] as number) / 255;
    // Pixel transparent : papier blanc (le canvas du rendu est deja rempli en blanc).
    const r = ((rgba[i * 4] as number) * a + 255 * (1 - a)) / 255;
    const g = ((rgba[i * 4 + 1] as number) * a + 255 * (1 - a)) / 255;
    const b = ((rgba[i * 4 + 2] as number) * a + 255 * (1 - a)) / 255;
    const k = 1 - Math.max(r, g, b);
    const d = 1 - k;
    out[i * 4] = d === 0 ? 0 : Math.round(((1 - r - k) / d) * 255);
    out[i * 4 + 1] = d === 0 ? 0 : Math.round(((1 - g - k) / d) * 255);
    out[i * 4 + 2] = d === 0 ? 0 : Math.round(((1 - b - k) / d) * 255);
    out[i * 4 + 3] = Math.round(k * 255);
  }
  return out;
}
