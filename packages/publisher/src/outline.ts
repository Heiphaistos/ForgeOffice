// Contour d'une forme (habillage « ajuste ») : chemin de la geometrie (predefinie ou libre) aplati en polygones,
// avec retournement et rotation, dans le repere de la zone de texte. Sans DOM.
import type { Shape } from '@forgeoffice/pptx';
import { buildGeometry } from '@forgeoffice/powerpoint/geometry';
import type { Pt } from './wrap.ts';

const BEZIER_STEPS = 10;
const MAX_POINTS = 4000;

/** Chemin « M L C Q Z » (absolu) en polygones. */
export function flattenPath(d: string): Pt[][] {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let cmd = '';
  let i = 0;
  let cx = 0;
  let cy = 0;
  let total = 0;
  const n = (): number => Number(tokens[i++] ?? 0);
  const add = (x: number, y: number): void => {
    if (total++ < MAX_POINTS) cur.push([x, y]);
  };
  const end = (): void => {
    if (cur.length > 2) polys.push(cur);
    cur = [];
  };
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i] as string)) cmd = (tokens[i++] as string).toUpperCase();
    switch (cmd) {
      case 'M':
        end();
        cx = n();
        cy = n();
        add(cx, cy);
        cmd = 'L';
        break;
      case 'L':
        cx = n();
        cy = n();
        add(cx, cy);
        break;
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = [n(), n(), n(), n(), n(), n()] as [number, number, number, number, number, number];
        for (let k = 1; k <= BEZIER_STEPS; k++) {
          const t = k / BEZIER_STEPS;
          const u = 1 - t;
          add(u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
        }
        cx = x3;
        cy = y3;
        break;
      }
      case 'Q': {
        const [x1, y1, x2, y2] = [n(), n(), n(), n()] as [number, number, number, number];
        for (let k = 1; k <= BEZIER_STEPS; k++) {
          const t = k / BEZIER_STEPS;
          const u = 1 - t;
          add(u * u * cx + 2 * u * t * x1 + t * t * x2, u * u * cy + 2 * u * t * y1 + t * t * y2);
        }
        cx = x2;
        cy = y2;
        break;
      }
      case 'Z':
        end();
        break;
      default:
        i++;
    }
  }
  end();
  return polys;
}

/**
 * Polygones du contour d'une forme, dans le repere de la zone de texte (origine = `originX`, `originY` dans la page).
 * null quand la forme n'a pas de geometrie propre (tableau, graphique, groupe) : l'habillage utilise alors son rectangle.
 */
export function shapeOutline(shape: Shape, originX: number, originY: number): Pt[][] | null {
  const x = shape.xfrm;
  if (!x || x.width <= 0 || x.height <= 0) return null;
  if (shape.kind !== 'shape' && shape.kind !== 'picture' && shape.kind !== 'media') return null;
  const geo = buildGeometry(shape.geometry, x.width, x.height);
  const rot = ((x.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const polys: Pt[][] = [];
  for (const path of geo.paths) {
    if (path.fill === 'none') continue;
    for (const poly of flattenPath(path.d)) {
      polys.push(
        poly.map(([px, py]): Pt => {
          const lx = (x.flipH ? x.width - px : px) - x.width / 2;
          const ly = (x.flipV ? x.height - py : py) - x.height / 2;
          return [x.x + x.width / 2 + lx * cos - ly * sin - originX, x.y + x.height / 2 + ly * cos + lx * sin - originY];
        }),
      );
    }
  }
  return polys.length ? polys : null;
}
