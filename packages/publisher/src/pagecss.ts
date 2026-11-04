// Feuille de style d'une page (sans DOM) : habillage du texte autour des objets (flottants CSS avec shape-outside,
// meme regle que la mesure de flow.ts) et lettrines (initial-letter). Portee : classe `pubp-<page>` de la page.
import type { Slide } from '@forgeoffice/pptx';
import { frameOf, isTextFrame } from './chain.ts';
import { columnWidth, obstacleFloat } from './flow.ts';
import { shapeKey, type PubSettings } from './model.ts';

export const pageClass = (pageId: number): string => `pubp-${pageId}`;

const px = (v: number): string => `${Math.round(v * 100) / 100}px`;

/** Regles CSS de la page ; `accent` = couleur des lettrines. */
export function pageCss(slide: Slide, pub: PubSettings, accent: string): string {
  const scope = `.${pageClass(slide.id)}`;
  const rules: string[] = [];
  for (const shape of slide.shapes) {
    if (!isTextFrame(shape)) continue;
    const sel = `${scope} [data-shape-id="${shape.id}"]`;
    const frame = frameOf(slide, shape, pub);
    const cw = columnWidth(frame);
    const floats = frame.obstacles.map((o) => obstacleFloat(o, cw)).filter((f) => f !== null).slice(0, 2);
    floats.forEach((f, i) => {
      const target = i === 0 ? `${sel} [data-text-flow]::before` : `${sel} [data-text-flow] > [data-p="0"]::before`;
      const shapeOutside = f.ellipse ? `ellipse(${px(f.ellipse.rx)} ${px(f.ellipse.ry)} at ${px(f.ellipse.cx)} ${px(f.ellipse.cy)})` : `inset(${px(f.top)} 0 0 0)`;
      rules.push(`${target}{content:"";float:${f.side};width:${px(f.width)};height:${px(f.bottom)};shape-outside:${shapeOutside};}`);
    });
    const drop = pub.dropCaps[shapeKey(slide.id, shape.id)];
    if (drop) rules.push(`${sel} [data-text-flow] > [data-p="0"]::first-letter{initial-letter:${drop};font-weight:700;color:${accent};margin-right:0.1em;}`);
  }
  return rules.join('\n');
}
