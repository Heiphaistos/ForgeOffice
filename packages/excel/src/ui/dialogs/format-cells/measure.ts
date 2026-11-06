// Mesure de texte par canvas (largeur en pixels d'un texte dans une police CSS), pour l'ajustement des lignes.
import type { Measure } from '../../../logic/rowfit.ts';

export function canvasMeasure(): Measure {
  const ctx = document.createElement('canvas').getContext('2d');
  return (text, font) => {
    if (!ctx) return text.length * 7;
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}
