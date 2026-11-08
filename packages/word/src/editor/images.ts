// Images : habillage, redimensionnement par poignees, alignement au deplacement (sans DOM).
import type { Floating, ImageInline } from '@forgeoffice/docx';

/** Tout objet pouvant etre ancre (image, forme, zone de texte). */
export interface Floater { floating?: Floating }

export type ImageWrap = 'inline' | 'square' | 'tight' | 'topAndBottom' | 'behind' | 'front';

export const IMAGE_WRAPS: readonly ImageWrap[] = ['inline', 'square', 'tight', 'topAndBottom', 'behind', 'front'];

/** Habillage courant d'une image. */
export function wrapOf(img: Floater): ImageWrap {
  const f = img.floating;
  if (!f) return 'inline';
  if (f.wrap === 'none') return f.behindText ? 'behind' : 'front';
  if (f.wrap === 'through') return 'tight';
  return f.wrap;
}

/** Proprietes a poser pour un habillage ; garde la position d'une image deja flottante. */
export function wrapPatch(img: Floater, mode: ImageWrap): { floating: Floating | undefined } {
  if (mode === 'inline') return { floating: undefined };
  const old = img.floating;
  const wrap = mode === 'behind' || mode === 'front' ? 'none' : mode;
  return {
    floating: {
      horizontal: old?.horizontal ?? { relativeTo: 'column', align: 'left' },
      vertical: old?.vertical ?? { relativeTo: 'paragraph', offset: 0 },
      wrap,
      behindText: mode === 'behind',
      distance: old?.distance ?? { top: 0, right: 9, bottom: 0, left: 9 },
      allowOverlap: true,
      zIndex: old?.zIndex ?? 1,
    },
  };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const MIN = 8;

/** Nouvelle taille (points) apres un glissement de poignee ; les coins gardent les proportions sauf si `free`. */
export function resizeBox(handle: Handle, start: { width: number; height: number }, dx: number, dy: number, free = false): { width: number; height: number } {
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  let width = start.width + sx * dx;
  let height = start.height + sy * dy;
  if (sx && sy && !free) {
    const ratio = start.height / Math.max(1, start.width);
    // Le sens qui bouge le plus gouverne.
    if (Math.abs(sx * dx) / Math.max(1, start.width) >= Math.abs(sy * dy) / Math.max(1, start.height)) height = width * ratio;
    else width = height / ratio;
  }
  return { width: Math.max(MIN, width), height: Math.max(MIN, height) };
}

/** Alignement horizontal d'une image deposee a l'abscisse `x` de la zone de texte. */
export function alignFromX(x: number, textLeft: number, textWidth: number): 'left' | 'center' | 'right' {
  const f = (x - textLeft) / Math.max(1, textWidth);
  return f < 1 / 3 ? 'left' : f > 2 / 3 ? 'right' : 'center';
}

/** Image flottante placee a un alignement horizontal. */
export function withAlign<T extends Floater>(img: T, align: 'left' | 'center' | 'right'): T {
  const f = img.floating;
  if (!f) return img;
  return { ...img, floating: { ...f, horizontal: { relativeTo: f.horizontal.relativeTo === 'page' ? 'column' : f.horizontal.relativeTo, align } } };
}

/** Image deplacee de (dx, dy) points : le decalage s'ajoute aux decalages horizontal et vertical de l'ancrage. */
export function nudge<T extends Floater>(img: T, dx: number, dy: number): T {
  const f = img.floating;
  if (!f) return img;
  return { ...img, floating: { ...f, horizontal: { ...f.horizontal, offset: (f.horizontal.offset ?? 0) + dx }, vertical: { ...f.vertical, offset: (f.vertical.offset ?? 0) + dy } } };
}

/** Angle de rotation (degres, 0..359) d'une poignee tiree au point (x, y) autour du centre (cx, cy) ; `snap` arrondit a 15 degres. */
export function rotationFrom(cx: number, cy: number, x: number, y: number, snap: boolean): number {
  let deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
  if (snap) deg = Math.round(deg / 15) * 15;
  return ((Math.round(deg) % 360) + 360) % 360;
}
