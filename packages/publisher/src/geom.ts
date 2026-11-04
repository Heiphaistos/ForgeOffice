// Petites fonctions de geometrie et de texte sans DOM (la logique testee ne charge pas l'editeur React).
import type { Paragraph, Run, Transform } from '@forgeoffice/pptx';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Marges interieures par defaut d'une zone de texte (identiques au rendu TextBlock). */
export const DEFAULT_INSETS = { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 };

/** Rectangle englobant (axes de la page) d'une forme, rotation comprise. */
export function boundsOfXfrm(x: Transform): Rect {
  const r = ((x.rotation ?? 0) * Math.PI) / 180;
  if (!r) return { x: x.x, y: x.y, width: x.width, height: x.height };
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const w = x.width * cos + x.height * sin;
  const h = x.width * sin + x.height * cos;
  return { x: x.x + x.width / 2 - w / 2, y: x.y + x.height / 2 - h / 2, width: w, height: h };
}

const runLength = (run: Run): number => (run.type === 'break' ? 1 : run.text.length);

/** Coupe les segments pour qu'une frontiere existe au decalage `o` ; renvoie l'indice du segment qui y commence. */
export function splitRunsAt(p: Paragraph, o: number): number {
  let at = 0;
  for (let i = 0; i < p.runs.length; i++) {
    const run = p.runs[i] as Run;
    const len = runLength(run);
    if (o <= at) return i;
    if (o < at + len) {
      if (run.type !== 'text') return i + 1;
      p.runs.splice(i, 1, { type: 'text', text: run.text.slice(0, o - at), props: run.props }, { type: 'text', text: run.text.slice(o - at), props: { ...run.props } });
      return i + 1;
    }
    at += len;
  }
  return p.runs.length;
}
